import {
  isSectioning,
  type Box,
  type PageMetrics,
  type PageNode,
  type PageTree,
  type Placement,
  type SectionInput,
} from '@/core/sections';
import { parentOf, visualChildrenOf } from './dom';

/** Our own top-layer host, which the rules must never see. */
const OVERLAY_TAG = 'ai-interaction-overlay';
/** A list longer than this isn't a page wrapper's set of sections, so the rest of it isn't read. */
const MAX_CHILDREN = 100;
const MAX_CONTENTS_DEPTH = 5;

/** What the section rules need, plus the elements behind the indices they answer with. */
export interface ReadInput {
  input: SectionInput;
  /** The page elements behind `input.chain`. */
  chain: Element[];
  /** The page elements behind `input.chain[0].children`. */
  firstChildren: Element[];
  /** The scroll position the page coordinates were read with. */
  scroll: { x: number; y: number };
}

/**
 * Reads the hovered element and its ancestors for the section rules. It only
 * reads: nothing on the page changes. `x` and `y` are viewport coordinates.
 */
export function readSectionInput(hovered: Element, x: number, y: number): ReadInput {
  const scroll = { x: window.scrollX, y: window.scrollY };
  const chain: Element[] = [];
  const nodes: PageNode[] = [];
  let firstChildren: Element[] = [];

  for (let element: Element | null = outermostSvg(hovered); element; element = parentOf(element)) {
    const box = pageBox(element, scroll);
    // Elements without a box (display: contents, empty wrappers) are skipped. The hovered one always counts.
    if (chain.length > 0 && (box.width <= 0 || box.height <= 0)) continue;
    const children = renderedChildren(element);
    if (chain.length === 0) firstChildren = children;
    chain.push(element);
    nodes.push(readNode(element, box, children, scroll));
  }

  return {
    input: { chain: nodes, ...readMetrics(scroll), pointer: { x: x + scroll.x, y: y + scroll.y } },
    chain,
    firstChildren,
    scroll,
  };
}

/** The page for Full page, read lazily from <body> down: only the parts the outline rules ask for. */
export function readPageTree(): { body: PageTree; metrics: PageMetrics; elementOf(tree: PageTree): Element } {
  const scroll = { x: window.scrollX, y: window.scrollY };
  const elements = new Map<PageTree, Element>();

  const treeOf = (element: Element): PageTree => {
    const children = renderedChildren(element);
    let subtrees: PageTree[] | null = null;
    const tree: PageTree = {
      node: readNode(element, pageBox(element, scroll), children, scroll),
      subtrees: () => (subtrees ??= children.map(treeOf)),
    };
    elements.set(tree, element);
    return tree;
  };

  return {
    body: treeOf(document.body),
    metrics: readMetrics(scroll),
    elementOf: (tree) => elements.get(tree)!,
  };
}

/** Children that draw a box, in the order the page lists them. */
export function renderedChildren(element: Element): Element[] {
  const result: Element[] = [];
  const visit = (parent: Element, depth: number) => {
    for (const child of visualChildrenOf(parent)) {
      if (result.length >= MAX_CHILDREN) return;
      if (child.localName === OVERLAY_TAG) continue;
      // A display: contents element has no box of its own: its children take its place.
      if (getComputedStyle(child).display === 'contents') {
        if (depth < MAX_CONTENTS_DEPTH) visit(child, depth + 1);
        continue;
      }
      const rect = child.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) result.push(child);
    }
  };
  visit(element, 0);
  return result;
}

function readNode(element: Element, box: Box, children: readonly Element[], scroll: { x: number; y: number }): PageNode {
  const style = getComputedStyle(element);
  const tag = element.localName;
  // The page's own scrolling belongs to the viewport, so <html> and <body> never clip.
  const isRoot = tag === 'html' || tag === 'body';
  return {
    tag,
    role: element.getAttribute('role'),
    box,
    display: style.display,
    placement: placementOf(style),
    clipsX: !isRoot && style.overflowX !== 'visible',
    clipsY: !isRoot && style.overflowY !== 'visible',
    topLayer: isInTopLayer(element),
    children: children.map((child) => ({
      box: pageBox(child, scroll),
      placement: placementOf(getComputedStyle(child)),
      sectioning: isSectioning(child.localName, child.getAttribute('role')),
    })),
  };
}

function readMetrics(scroll: { x: number; y: number }): PageMetrics {
  const root = document.documentElement;
  return {
    viewport: { left: scroll.x, top: scroll.y, width: root.clientWidth, height: root.clientHeight },
    pageHeight: root.scrollHeight,
  };
}

function pageBox(element: Element, scroll: { x: number; y: number }): Box {
  const rect = element.getBoundingClientRect();
  return { left: rect.left + scroll.x, top: rect.top + scroll.y, width: rect.width, height: rect.height };
}

function placementOf(style: CSSStyleDeclaration): Placement {
  switch (style.position) {
    case 'sticky':
    case 'absolute':
    case 'fixed':
      return style.position;
    default:
      return 'flow';
  }
}

/** Shapes inside an <svg> are parts of one drawing, such as an icon. */
function outermostSvg(element: Element): Element {
  let outermost = element;
  for (let node: Element | null = element; node; node = parentOf(node)) {
    if (node instanceof SVGSVGElement) outermost = node;
  }
  return outermost;
}

function isInTopLayer(element: Element): boolean {
  try {
    return element.matches(':modal, :popover-open, :fullscreen');
  } catch {
    return false;
  }
}
