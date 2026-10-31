import { elementAt, summarizeElement } from './dom';
import { createHighlightOverlay } from './overlay';

export interface PickerCallbacks {
  onSelect(element: Element): void;
  /** Picking stopped without a selection: Esc on the page, or the tab was hidden. */
  onCancel(): void;
}

/**
 * Lets the user pick an element: hovering highlights it, clicking selects it.
 * Hover and scrolling still reach the page, so its hover effects keep working.
 * Presses and clicks don't, so links don't navigate and buttons don't fire.
 * Returns a function that stops picking and removes everything the picker added.
 */
export function startPicker({ onSelect, onCancel }: PickerCallbacks): () => void {
  const overlay = createHighlightOverlay();
  const listeners = new AbortController();
  let pointer: { x: number; y: number } | null = null;
  let drawn: { element: Element; rect: DOMRect } | null = null;
  let frame = 0;
  let stopped = false;

  // At most one highlight update per frame, however fast the pointer moves.
  const scheduleUpdate = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  function update() {
    frame = 0;
    const element = pointer ? elementAt(pointer.x, pointer.y) : null;
    if (!element) {
      drawn = null;
      overlay.hide();
      return;
    }
    const rect = element.getBoundingClientRect();
    if (drawn?.element === element && sameRect(drawn.rect, rect)) return;
    drawn = { element, rect };
    overlay.show(rect, summarizeElement(element, rect));
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    listeners.abort();
    cancelAnimationFrame(frame);
    overlay.destroy();
  }

  const onPointerMove = (event: PointerEvent) => {
    pointer = { x: event.clientX, y: event.clientY };
    scheduleUpdate();
  };
  // Leaving the page (for example, moving into the side panel) hides the highlight.
  const onPointerOut = (event: PointerEvent) => {
    if (event.relatedTarget) return;
    pointer = null;
    scheduleUpdate();
  };
  // The page never sees these events, and their default actions are cancelled: no focus change,
  // text selection, drag, or navigation.
  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  // The page never sees these. Their default actions stay, e.g. Chrome's own right-click menu.
  const hideFromPage = (event: Event) => {
    event.stopImmediatePropagation();
  };
  // Selecting on `click`, the last event of a press, means no part of the press reaches the page afterwards.
  const onClick = (event: MouseEvent) => {
    swallow(event);
    // Only a real left click selects. Keyboard-triggered clicks have detail 0.
    if (event.button !== 0 || event.detail === 0) return;
    const element = elementAt(event.clientX, event.clientY);
    if (!element) return;
    stop();
    onSelect(element);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    swallow(event);
    stop();
    onCancel();
  };
  const onVisibilityChange = () => {
    if (!document.hidden) return;
    stop();
    onCancel();
  };

  // Capture listeners on window run before the page's own listeners on elements and the document.
  const active = { capture: true, signal: listeners.signal };
  const passive = { ...active, passive: true };
  window.addEventListener('pointermove', onPointerMove, passive);
  document.addEventListener('pointerout', onPointerOut, passive);
  window.addEventListener('scroll', scheduleUpdate, passive);
  window.addEventListener('resize', scheduleUpdate, passive);
  window.addEventListener('pointerdown', hideFromPage, active);
  window.addEventListener('pointerup', hideFromPage, active);
  window.addEventListener('contextmenu', hideFromPage, active);
  for (const type of ['mousedown', 'mouseup', 'dblclick', 'auxclick'] as const) {
    window.addEventListener(type, swallow, active);
  }
  window.addEventListener('click', onClick, active);
  window.addEventListener('keydown', onKeyDown, active);
  document.addEventListener('visibilitychange', onVisibilityChange, { signal: listeners.signal });

  return stop;
}

function sameRect(a: DOMRect, b: DOMRect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
