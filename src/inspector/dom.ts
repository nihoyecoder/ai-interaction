import { createElementSummary, type ElementSummary } from '@/core/element-summary';

/**
 * The element under a point. Looks inside open shadow roots (web components)
 * when the page allows it. Like normal hit testing, it skips elements that
 * ignore the pointer (`pointer-events: none`).
 */
export function elementAt(x: number, y: number): Element | null {
  let element = document.elementFromPoint(x, y);
  while (element?.shadowRoot) {
    const inner = element.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === element) break;
    element = inner;
  }
  return element;
}

/** The parent element. Steps out of a shadow root to its host. */
export function parentOf(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const parent = element.parentNode;
  return parent instanceof ShadowRoot ? parent.host : null;
}

/** All ancestors, from the top of the page down to the parent. */
export function ancestorsOf(element: Element): Element[] {
  const ancestors: Element[] = [];
  for (let parent = parentOf(element); parent; parent = parentOf(parent)) ancestors.unshift(parent);
  return ancestors;
}

/** Children that never show anything on the page. */
const NON_VISUAL_TAGS = new Set(['base', 'head', 'link', 'meta', 'noscript', 'script', 'style', 'template', 'title']);

/** Children that can show something: regular children first, then those in an open shadow root. */
export function visualChildrenOf(element: Element): Element[] {
  const children = [...Array.from(element.children), ...Array.from(element.shadowRoot?.children ?? [])];
  return children.filter((child) => !NON_VISUAL_TAGS.has(child.localName));
}

export function firstVisualChildOf(element: Element): Element | null {
  return visualChildrenOf(element)[0] ?? null;
}

export function summarizeElement(element: Element, rect: DOMRect = element.getBoundingClientRect()): ElementSummary {
  return createElementSummary({
    tag: element.localName,
    id: element.id,
    classes: Array.from(element.classList),
    width: rect.width,
    height: rect.height,
  });
}
