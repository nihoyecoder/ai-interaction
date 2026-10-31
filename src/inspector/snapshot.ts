import {
  createElementSnapshot,
  SNAPSHOT_PROPERTIES,
  type ElementNamespace,
  type ElementSnapshot,
  type Size,
} from '@/core/element-snapshot';
import { ancestorsOf, parentOf } from './dom';

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** Reads the selected element's details once. It only reads: nothing on the page changes. */
export function readSnapshot(element: Element, canSelectChild: boolean): ElementSnapshot {
  const computed = getComputedStyle(element);
  const styles: Record<string, string> = {};
  for (const property of SNAPSHOT_PROPERTIES) styles[property] = computed.getPropertyValue(property);

  return createElementSnapshot({
    tag: element.localName,
    id: element.id,
    classes: Array.from(element.classList),
    namespace: namespaceOf(element),
    rect: element.getBoundingClientRect(),
    scroll: { x: window.scrollX, y: window.scrollY },
    layoutSize: layoutSizeOf(element),
    path: ancestorsOf(element).map((ancestor) => ({
      tag: ancestor.localName,
      id: ancestor.id,
      classes: Array.from(ancestor.classList),
    })),
    styles,
    type: element.getAttribute('type'),
    open: element.hasAttribute('open'),
    hovered: element.matches(':hover'),
    canSelectParent: parentOf(element) !== null,
    canSelectChild,
  });
}

function namespaceOf(element: Element): ElementNamespace {
  if (element.namespaceURI === HTML_NAMESPACE) return 'html';
  if (element.namespaceURI === SVG_NAMESPACE) return 'svg';
  return 'other';
}

/**
 * The element's box size before transforms. Null for SVG elements inside an
 * <svg>, whose transform origin doesn't depend on their size.
 */
function layoutSizeOf(element: Element): Size | null {
  if (element instanceof HTMLElement) return { width: element.offsetWidth, height: element.offsetHeight };
  const isOuterSvg = element.localName === 'svg' && element.parentElement?.namespaceURI !== SVG_NAMESPACE;
  return isOuterSvg ? { width: element.clientWidth, height: element.clientHeight } : null;
}
