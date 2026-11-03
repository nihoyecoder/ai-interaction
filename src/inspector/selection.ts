import { pageOutline } from '@/core/sections';
import {
  createElementSelection,
  createPageSelection,
  type ElementSelection,
  type PageSelection,
  type PickMode,
} from '@/core/selection';
import { ancestorsOf } from './dom';
import { readPageTree } from './section-input';

/** Reads the selected element or section once. It only reads: nothing on the page changes. */
export function readElementSelection(
  element: Element,
  scope: PickMode,
  steps: { canWiden: boolean; canNarrow: boolean },
): ElementSelection {
  return createElementSelection({
    scope,
    ...nameOf(element),
    rect: element.getBoundingClientRect(),
    scroll: { x: window.scrollX, y: window.scrollY },
    path: ancestorsOf(element).map(nameOf),
    ...steps,
    viewport: viewportSize(),
  });
}

/** Reads the whole page's sections for Full page, once. */
export function readPageSelection(): PageSelection {
  const { body, metrics, elementOf } = readPageTree();
  const sections = pageOutline(body, metrics).map((tree) => ({
    ...nameOf(elementOf(tree)),
    width: tree.node.box.width,
    height: tree.node.box.height,
    // An absolutely positioned bar scrolls with the page, like the rest of it.
    placement: tree.node.placement === 'absolute' ? 'flow' : tree.node.placement,
  }));
  const root = document.documentElement;
  return createPageSelection({
    page: { width: root.scrollWidth, height: root.scrollHeight },
    viewport: viewportSize(),
    sections,
  });
}

function nameOf(element: Element) {
  return { tag: element.localName, id: element.id, classes: Array.from(element.classList) };
}

function viewportSize() {
  return { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
}
