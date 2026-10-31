import { summarizeElement } from './dom';
import { createHighlightOverlay } from './overlay';

const FLASH_MS = 1500;

/**
 * Briefly highlights an element, for example after "Select parent", so the
 * user can see what's selected. It never scrolls the page, because scrolling
 * could trigger the site's own scroll animations. Returns a function that
 * removes the highlight early.
 */
export function flashElement(element: Element): () => void {
  const overlay = createHighlightOverlay();
  const rect = element.getBoundingClientRect();
  overlay.show(rect, summarizeElement(element, rect));
  const timer = setTimeout(() => overlay.destroy(), FLASH_MS);
  return () => {
    clearTimeout(timer);
    overlay.destroy();
  };
}
