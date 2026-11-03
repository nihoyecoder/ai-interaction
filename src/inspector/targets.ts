import { elementLevels, findSection, sameBox, type Box } from '@/core/sections';
import type { PickMode } from '@/core/selection';
import { isInside } from './dom';
import { readSectionInput, renderedChildren } from './section-input';

/** What the picker highlights: one of the levels ↑ and ↓ move through. */
export interface Target {
  levels: TargetLevel[];
  index: number;
}

export interface TargetLevel {
  element: Element;
  /** What can be seen of its box, in viewport coordinates. */
  rect: DOMRect;
}

/** How deep "Narrower" looks for a box that differs from the selected one. */
const MAX_NARROWER_DEPTH = 30;

/**
 * The target under the pointer: the hovered element in Element mode, its
 * section in Section mode. `x` and `y` are viewport coordinates.
 */
export function targetAt(hovered: Element, x: number, y: number, mode: PickMode): Target | null {
  let read = readSectionInput(hovered, x, y);
  let result = mode === 'section' ? findSection(read.input) : elementLevels(read.input);

  if (result.kind === 'between') {
    // The pointer is on a page wrapper, between sections: take the nearest one, from its closest point.
    const child = read.firstChildren[result.child];
    if (!child) return null;
    const rect = child.getBoundingClientRect();
    read = readSectionInput(child, clamp(x, rect.left, rect.right), clamp(y, rect.top, rect.bottom));
    result = findSection(read.input);
  }
  if (result.kind !== 'levels') return null;

  const { scroll } = read;
  const levels = result.levels.map((level) => ({ element: read.chain[level.element]!, rect: toViewport(level.box, scroll) }));
  return { levels, index: result.initial };
}

/** "Wider": the next bigger container that looks different on the page. */
export function widerThan(element: Element): Element | null {
  const rect = element.getBoundingClientRect();
  const read = readSectionInput(element, rect.left + rect.width / 2, rect.top + rect.height / 2);
  const result = elementLevels(read.input);
  if (result.kind !== 'levels') return null;
  const level = result.levels[result.initial + 1];
  return level ? read.chain[level.element]! : null;
}

/**
 * "Narrower": the first element inside it that looks different on the page.
 * In-flow children come first, because absolute ones are usually decoration.
 * Shapes inside an <svg> are parts of one drawing, so it stops there.
 */
export function narrowerThan(element: Element): Element | null {
  const rect = element.getBoundingClientRect();
  let current = element;
  for (let depth = 0; depth < MAX_NARROWER_DEPTH; depth++) {
    if (current instanceof SVGSVGElement) return null;
    const children = renderedChildren(current);
    const child = children.find(isInFlow) ?? children[0];
    if (!child) return null;
    if (!sameBox(child.getBoundingClientRect(), rect)) return child;
    current = child;
  }
  return null;
}

/** "Narrower" after "Wider" goes back down the same way, while that element is still inside. */
export function trailBackTo(element: Element, trail: readonly Element[]): Element | null {
  const previous = trail.at(-1);
  return previous && previous !== element && isInside(previous, element) ? previous : null;
}

function isInFlow(element: Element): boolean {
  const { position } = getComputedStyle(element);
  return position !== 'absolute' && position !== 'fixed';
}

function toViewport(box: Box, scroll: { x: number; y: number }): DOMRect {
  return new DOMRect(box.left - scroll.x, box.top - scroll.y, box.width, box.height);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
