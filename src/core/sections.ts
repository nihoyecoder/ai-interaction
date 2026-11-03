/**
 * Decides which page section an element belongs to (Select Design's Section
 * mode), the steps ↑ and ↓ move through, and which blocks make up the whole
 * page (Full page). Pure logic on boxes read from the page, so it's
 * unit-tested without one.
 *
 * Most pages are a wrapper holding a stack of blocks: header, hero, features,
 * pricing, footer. A section is one of those blocks, including its full-width
 * background, not the narrower column inside it. Wrappers are recognized by
 * their shape, because many sites use plain divs:
 * - Several blocks stacked on top of each other, flush with the wrapper.
 *   A section has padding; a page wrapper doesn't.
 * - Page-tall columns side by side, such as a docs sidebar and its content.
 * - A wrapper around another wrapper, such as a framework's root element.
 * Sectioning tags (header, section, footer…) and landmark roles count as one
 * section, unless they hold several sections themselves.
 */

/** A box in page coordinates (CSS px): getBoundingClientRect() plus the scroll position. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** From the computed `position`: static and relative are 'flow'. */
export type Placement = 'flow' | 'sticky' | 'absolute' | 'fixed';

export interface ChildBox {
  box: Box;
  placement: Placement;
  sectioning: boolean;
}

/** One element, as the section rules see it. */
export interface PageNode {
  tag: string;
  role: string | null;
  box: Box;
  display: string;
  placement: Placement;
  /** Its overflow hides what's outside its box. Always false for <html> and <body>. */
  clipsX: boolean;
  clipsY: boolean;
  /** Shown in the browser's top layer: a modal dialog, an open popover, or full screen. */
  topLayer: boolean;
  /** Children that draw a box: display: contents flattened, open shadow roots included, empty boxes left out. */
  children: ChildBox[];
}

export interface PageMetrics {
  /** The visible part of the page: its scroll position and size. */
  viewport: Box;
  /** The full height of the page (documentElement.scrollHeight). */
  pageHeight: number;
}

export interface SectionInput extends PageMetrics {
  /**
   * The hovered element first, then its ancestors up to <html>. Anything inside
   * an <svg> starts at the outermost <svg>. Elements without a box are left out.
   */
  chain: PageNode[];
  /** In page coordinates. */
  pointer: { x: number; y: number };
}

/** One step for ↑ and ↓: elements of the chain that share what's visible of their box, inner first. */
export interface SectionLevel {
  members: number[];
  /** The member that names the level: its outermost sectioning element, or else its outermost element. */
  element: number;
  /** The part of the box that can be seen, after ancestors that hide their overflow. */
  box: Box;
}

export type SectionResult =
  | { kind: 'levels'; levels: SectionLevel[]; initial: number }
  /** The pointer is on a page wrapper itself, between sections: snap to `chain[0].children[child]`. */
  | { kind: 'between'; child: number }
  | { kind: 'none' };

/** Edges this close (px) still count as reaching the parent's edges. */
const EDGE_PX = 8;
/** A block this close (px) to its wrapper's top or bottom is flush with it: no section padding in between. */
const FLUSH_PX = 24;
/** Children shorter than this (px) are ignored, such as spacers and rules. */
const MIN_PART_PX = 16;
/** Boxes this close (px) are the same box. */
const SAME_PX = 2;

const SECTIONING_TAGS = new Set(['section', 'article', 'aside', 'nav', 'header', 'footer']);
const SECTIONING_ROLES = new Set(['region', 'banner', 'contentinfo', 'navigation', 'complementary', 'search', 'article']);

/** Marks itself as a section: a sectioning tag or a landmark role. A role wins over the tag. */
export function isSectioning(tag: string, role: string | null): boolean {
  return role ? SECTIONING_ROLES.has(role) : SECTIONING_TAGS.has(tag);
}

export function sameBox(a: Box, b: Box): boolean {
  return [a.left - b.left, a.top - b.top, right(a) - right(b), bottom(a) - bottom(b)].every(
    (difference) => Math.abs(difference) <= SAME_PX,
  );
}

/**
 * Section mode: the section containing the hovered element, and the levels
 * around it. Walking down from the top of the page, the section is the first
 * element that isn't a page wrapper.
 */
export function findSection(input: SectionInput): SectionResult {
  const start = walkStart(input.chain);
  if (start < 0) return snapToChild(input, input.chain[0]);

  const page = pageContext(input);
  const pageLevel: boolean[] = [];
  for (let index = 0; index <= start; index++) {
    const node = input.chain[index]!;
    const child = input.chain[index - 1];
    // A fixed or top-layer start is positioned against the screen, not its parent.
    const parent = index === start && isLayer(node) ? input.viewport : input.chain[index + 1]!.box;
    pageLevel[index] =
      stacksSections(page, node, parent) ||
      splitsIntoColumns(page, node) ||
      (isLayer(input.chain[start]!) && isBackdrop(page, node)) ||
      (child !== undefined && holdsFloatingBar(page, node, child)) ||
      (child !== undefined && (pageLevel[index - 1] ?? false) && wrapsPageWrapper(node, child));
  }

  for (let index = start; index >= 0; index--) {
    if (!pageLevel[index]) return levelsAround(input, start, index);
  }
  return snapToChild(input, input.chain[0]);
}

/** Element mode: the same levels, starting from the hovered element itself. */
export function elementLevels(input: SectionInput): SectionResult {
  const first = input.chain[0];
  if (!first) return { kind: 'none' };
  const start = walkStart(input.chain);
  // The pointer is on <body> or <html>: there's nothing between it and the page.
  if (start < 0) return { kind: 'levels', levels: [{ members: [0], element: 0, box: first.box }], initial: 0 };
  return levelsAround(input, start, 0);
}

/** A part of the page, for Full page. Its subtrees are read only when the rules need them. */
export interface PageTree {
  node: PageNode;
  /** The children's own trees, in the same order as `node.children`. */
  subtrees(): readonly PageTree[];
}

/** How deep the outline looks for page wrappers inside page wrappers. */
const MAX_OUTLINE_DEPTH = 12;

/**
 * Full page: the page's sections, in the order the page's code lists them.
 * Starts at <body> and opens every page wrapper it finds, so the result is
 * what Section mode picks when hovering each part of the page.
 */
export function pageOutline(body: PageTree, metrics: PageMetrics): PageTree[] {
  const page = pageContext(metrics);
  const wrappers = new Map<PageTree, boolean>();

  const isWrapper = (tree: PageTree, parent: Box, depth: number): boolean => {
    const known = wrappers.get(tree);
    if (known !== undefined) return known;
    const { node } = tree;
    const wrapper =
      stacksSections(page, node, parent) ||
      splitsIntoColumns(page, node) ||
      tree.subtrees().some(
        (child) =>
          holdsFloatingBar(page, node, child.node) ||
          // Check the cheap shape test first: only a child that fills most of this element can pass it on.
          (depth < MAX_OUTLINE_DEPTH && wrapsPageWrapper(node, child.node) && isWrapper(child, node.box, depth + 1)),
      );
    wrappers.set(tree, wrapper);
    return wrapper;
  };

  const sections: PageTree[] = [];
  const open = (tree: PageTree, depth: number) => {
    for (const child of tree.subtrees()) {
      if (!isListed(child.node, tree.node, page)) continue;
      const canOpen = child.node.placement === 'flow' || child.node.placement === 'sticky';
      if (canOpen && depth < MAX_OUTLINE_DEPTH && isWrapper(child, tree.node.box, 0)) open(child, depth + 1);
      else sections.push(child);
    }
  };
  open(body, 0);
  return sections;
}

interface PageContext extends PageMetrics {
  /** At least two screens tall. */
  long: boolean;
}

function pageContext({ viewport, pageHeight }: PageMetrics): PageContext {
  return { viewport, pageHeight, long: pageHeight >= 2 * viewport.height };
}

/**
 * Where the walk down the chain starts: the element just below <body>, or the
 * outermost fixed or top-layer element, which ignores its ancestors.
 */
function walkStart(chain: readonly PageNode[]): number {
  const root = chain.findIndex((node) => node.tag === 'body' || node.tag === 'html');
  const outerLayer = chain.slice(0, Math.max(root, 0)).findLastIndex(isLayer);
  return outerLayer >= 0 ? outerLayer : root - 1;
}

/** Several sections stacked vertically. */
function stacksSections(page: PageContext, node: PageNode, parent: Box): boolean {
  const parts = flowParts(node).sort((a, b) => a.box.top - b.box.top);
  if (parts.length < 2 || isVetoed(node, parts)) return false;

  // Parts side by side or on top of each other aren't a stack. Small overlaps are fine: content that
  // reveals on scroll starts out shifted.
  let lowest = bottom(parts[0]!.box);
  for (const part of parts.slice(1)) {
    if (part.box.top < lowest - Math.max(SAME_PX, 0.5 * part.box.height)) return false;
    lowest = Math.max(lowest, bottom(part.box));
  }

  // On a long page, a page-scale element holding several big blocks is a wrapper, whatever their width.
  const big = parts.filter((part) => part.box.height >= 0.25 * page.viewport.height && part.box.width >= 0.5 * node.box.width);
  if (page.long && isPageScale(page, node.box) && fills(node, big)) return true;

  // Otherwise it's a stack of full-width bands, flush with the element, which itself spans its parent or the page.
  const flush = parts[0]!.box.top - node.box.top <= FLUSH_PX || bottom(node.box) - lowest <= FLUSH_PX;
  const bands = parts.filter((part) => spans(part.box, node.box));
  return flush && (spans(node.box, parent) || isPageScale(page, node.box)) && fills(node, bands);
}

/** Page-level columns side by side, such as a docs sidebar or an app's navigation. */
function splitsIntoColumns(page: PageContext, node: PageNode): boolean {
  const columns = node.children.filter(
    (child) => (child.placement === 'flow' || child.placement === 'sticky') && child.box.height >= MIN_PART_PX,
  );
  if (!isPageScale(page, node.box) || isVetoed(node, columns)) return false;
  return columns.some((a, i) => columns.some((b, j) => j > i && sideBySide(a.box, b.box)));
}

/**
 * Inside a fixed or top-layer layer, a screen-sized box around a smaller panel,
 * such as a modal's backdrop. It must be about the size of the screen: a fixed
 * smooth-scrolling wrapper holds page-tall content, which is made of sections.
 */
function isBackdrop(page: PageContext, node: PageNode): boolean {
  const parts = flowParts(node);
  return (
    coversScreen(page, node) &&
    node.box.height <= 1.1 * page.viewport.height &&
    parts.length > 0 &&
    parts.every((part) => part.box.width < 0.8 * node.box.width && part.box.height < 0.8 * node.box.height)
  );
}

/** A full-width bar floating over a page-sized block, such as a header laid over the hero of a one-screen page. */
function holdsFloatingBar(page: PageContext, node: PageNode, child: PageNode): boolean {
  if (child.placement !== 'absolute' && child.placement !== 'sticky') return false;
  const tallest = Math.max(0, ...flowParts(node).map((part) => part.box.height));
  return spans(child.box, node.box) && isPageScale(page, node.box) && tallest >= 0.5 * node.box.height;
}

/** A wrapper around a page wrapper: the child touches its top or bottom and fills most of it. */
function wrapsPageWrapper(node: PageNode, child: PageNode): boolean {
  if (child.placement !== 'flow' && child.placement !== 'sticky') return false;
  const touches = child.box.top <= node.box.top + FLUSH_PX || bottom(child.box) >= bottom(node.box) - FLUSH_PX;
  return touches && overlapArea(child.box, node.box) >= 0.5 * node.box.width * node.box.height;
}

/**
 * The levels for ↑ and ↓, from the hovered element up to the walk's start,
 * with `chosen` as the initial one. The whole page isn't a level: that's
 * Full page's job.
 */
function levelsAround(input: SectionInput, start: number, chosen: number): SectionResult {
  const { chain, pointer, viewport, pageHeight } = input;
  const page = pageContext(input);

  // Levels use what can be seen: boxes clipped by ancestors that hide their overflow.
  const open = { left: -Infinity, top: -Infinity, right: Infinity, bottom: Infinity };
  let clip = open;
  const visible: Box[] = [];
  for (let index = start; index >= 0; index--) {
    const node = chain[index]!;
    if (node.placement === 'fixed') clip = open;
    const left = Math.max(node.box.left, clip.left);
    const top = Math.max(node.box.top, clip.top);
    visible[index] = {
      left,
      top,
      width: Math.max(0, Math.min(right(node.box), clip.right) - left),
      height: Math.max(0, Math.min(bottom(node.box), clip.bottom) - top),
    };
    if (node.clipsX) clip = { ...clip, left: Math.max(clip.left, node.box.left), right: Math.min(clip.right, right(node.box)) };
    if (node.clipsY) clip = { ...clip, top: Math.max(clip.top, node.box.top), bottom: Math.min(clip.bottom, bottom(node.box)) };
  }

  const levels: SectionLevel[] = [];
  for (let index = 0; index <= start; index++) {
    const box = visible[index]!;
    // An inline element's box is spread over lines of text, so it isn't a useful step.
    const inline = index > 0 && index !== chosen && chain[index]!.display === 'inline';
    if (inline || box.width <= 0 || box.height <= 0) continue;
    // A key press must always change the highlight, so elements with the same box share a level.
    const last = levels.at(-1);
    if (last && sameBox(last.box, box)) last.members.push(index);
    else levels.push({ members: [index], element: index, box });
  }
  if (levels.length === 0) return { kind: 'none' };

  let initial = Math.max(0, levels.findLastIndex((level) => level.members[0]! <= chosen));
  // Start lower when the pointer is outside the chosen box, such as on a menu hanging below its header.
  while (initial > 0 && !contains(levels[initial]!.box, pointer)) initial--;

  const isWholePage = (level: SectionLevel) =>
    (level.box.width >= 0.95 * viewport.width && level.box.height >= 0.95 * pageHeight) ||
    level.members.some((index) => isLayer(chain[index]!) && coversScreen(page, chain[index]!));
  while (levels.length - 1 > initial && isWholePage(levels.at(-1)!)) levels.pop();

  for (const level of levels) {
    level.element =
      level.members.findLast((index) => isSectioning(chain[index]!.tag, chain[index]!.role)) ?? level.members.at(-1)!;
  }
  return { kind: 'levels', levels, initial };
}

/** The pointer is on a page wrapper itself: snap to its nearest child in the flow. */
function snapToChild({ pointer }: SectionInput, node: PageNode | undefined): SectionResult {
  const distance = (box: Box) =>
    Math.hypot(
      Math.max(0, box.left - pointer.x, pointer.x - right(box)),
      Math.max(0, box.top - pointer.y, pointer.y - bottom(box)),
    );
  let nearest = -1;
  node?.children.forEach((child, index) => {
    if (child.placement === 'absolute' || child.placement === 'fixed') return;
    if (nearest === -1 || distance(child.box) < distance(node.children[nearest]!.box)) nearest = index;
  });
  return nearest === -1 ? { kind: 'none' } : { kind: 'between', child: nearest };
}

/** Whether Full page lists a child of a page wrapper. */
function isListed(node: PageNode, parent: PageNode, page: PageContext): boolean {
  if (node.box.width < MIN_PART_PX || node.box.height < MIN_PART_PX) return false;
  // Off-canvas menus wait outside the page.
  if (right(node.box) <= 0 || node.box.left >= page.viewport.width + page.viewport.left) return false;
  switch (node.placement) {
    case 'flow':
    case 'sticky':
      return true;
    // Absolute children are usually decoration, unless they're a bar across the top, such as a header.
    case 'absolute':
      return spans(node.box, parent.box) && node.box.height < 0.5 * parent.box.height;
    // Fixed bars and side panels stay on screen. Small floating buttons, such as a chat button, aren't sections.
    case 'fixed':
      return node.box.width >= 0.25 * page.viewport.width || node.box.height >= 0.5 * page.viewport.height;
  }
}

function flowParts(node: PageNode): ChildBox[] {
  return node.children.filter((child) => child.placement === 'flow' && child.box.height >= MIN_PART_PX);
}

/** A sectioning element is one section, unless it holds at least two sectioning elements. */
function isVetoed(node: PageNode, parts: readonly ChildBox[]): boolean {
  return isSectioning(node.tag, node.role) && parts.filter((part) => part.sectioning).length < 2;
}

/** At least two parts, together at least half as tall as the element. */
function fills(node: PageNode, parts: readonly ChildBox[]): boolean {
  return parts.length >= 2 && parts.reduce((sum, part) => sum + part.box.height, 0) >= 0.5 * node.box.height;
}

/** Tall enough to be one of the page's main areas. On short pages, it must be almost the whole page. */
function isPageScale(page: PageContext, box: Box): boolean {
  return box.height >= (page.long ? 0.5 : 0.9) * page.pageHeight;
}

function isLayer(node: PageNode): boolean {
  return node.placement === 'fixed' || node.topLayer;
}

function coversScreen(page: PageContext, node: PageNode): boolean {
  return node.box.width >= 0.9 * page.viewport.width && node.box.height >= 0.9 * page.viewport.height;
}

/** Reaches (almost) both side edges of `outer`. */
function spans(inner: Box, outer: Box): boolean {
  return inner.left <= outer.left + EDGE_PX && right(inner) >= right(outer) - EDGE_PX;
}

function sideBySide(a: Box, b: Box): boolean {
  const apart = right(a) <= b.left + SAME_PX || right(b) <= a.left + SAME_PX;
  return apart && Math.min(bottom(a), bottom(b)) > Math.max(a.top, b.top);
}

function overlapArea(a: Box, b: Box): number {
  const width = Math.max(0, Math.min(right(a), right(b)) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(bottom(a), bottom(b)) - Math.max(a.top, b.top));
  return width * height;
}

function contains(box: Box, point: { x: number; y: number }): boolean {
  return point.x >= box.left && point.x <= right(box) && point.y >= box.top && point.y <= bottom(box);
}

function right(box: Box): number {
  return box.left + box.width;
}

function bottom(box: Box): number {
  return box.top + box.height;
}
