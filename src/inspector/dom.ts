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

export function summarizeElement(element: Element, rect: DOMRect = element.getBoundingClientRect()): ElementSummary {
  return createElementSummary({
    tag: element.localName,
    id: element.id,
    classes: Array.from(element.classList),
    width: rect.width,
    height: rect.height,
  });
}
