import type { PickMode } from '@/core/selection';
import { elementAt, summarizeElement } from './dom';
import { createHighlightOverlay } from './overlay';
import { targetAt, type Target } from './targets';

export interface PickerOptions {
  /** Element highlights what's under the pointer. Section highlights the page section it belongs to. */
  mode: PickMode;
  onSelect(element: Element): void;
  /** Picking stopped without a selection: Esc on the page, or the tab was hidden. */
  onCancel(): void;
}

export interface Picker {
  /** ↑: highlight the next bigger container. */
  widen(): void;
  /** ↓: go back down toward what's under the pointer. */
  narrow(): void;
  /** Stops picking and removes everything the picker added. */
  stop(): void;
}

/**
 * Lets the user pick an element or a section: hovering highlights it, ↑ and
 * ↓ widen and narrow the highlight, clicking selects it. Hover and scrolling
 * still reach the page, so its hover effects keep working. Presses and clicks
 * don't, so links don't navigate and buttons don't fire.
 */
export function startPicker({ mode, onSelect, onCancel }: PickerOptions): Picker {
  const overlay = createHighlightOverlay();
  const listeners = new AbortController();
  let pointer: { x: number; y: number } | null = null;
  let target: Target | null = null;
  // Set by ↑ and ↓. The chosen level stays while the pointer is inside it.
  let adjusted = false;
  let frame = 0;
  let stopped = false;

  // At most one highlight update per frame, however fast the pointer moves.
  const scheduleUpdate = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  function update() {
    frame = 0;
    const hovered = pointer ? elementAt(pointer.x, pointer.y) : null;
    const next = hovered && pointer ? targetAt(hovered, pointer.x, pointer.y, mode) : null;
    const chosen = adjusted ? target?.levels[target.index]?.element : undefined;
    const kept = chosen && next ? next.levels.findIndex((level) => level.element === chosen) : -1;
    if (next && kept >= 0) next.index = kept;
    else adjusted = false;
    target = next;
    draw();
  }

  function draw() {
    const level = target?.levels[target.index];
    if (!target || !level) {
      overlay.hide();
      return;
    }
    const hint = `${target.index < target.levels.length - 1 ? '↑' : ''}${target.index > 0 ? '↓' : ''}`;
    overlay.show(level.rect, summarizeElement(level.element, level.rect), hint);
  }

  function step(by: 1 | -1) {
    if (!target) return;
    const index = target.index + by;
    if (index < 0 || index >= target.levels.length) return;
    target.index = index;
    adjusted = true;
    draw();
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
    // The click can arrive before the last pointer move was drawn.
    pointer = { x: event.clientX, y: event.clientY };
    cancelAnimationFrame(frame);
    update();
    const element = target?.levels[target.index]?.element;
    if (!element) return;
    stop();
    onSelect(element);
  };
  // Keys reach the page only after the user clicks into it. Usually the side panel has focus, and it
  // sends ↑ and ↓ through `widen` and `narrow` instead.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape') {
      swallow(event);
      stop();
      onCancel();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      swallow(event);
      step(event.key === 'ArrowUp' ? 1 : -1);
    }
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

  return { widen: () => step(1), narrow: () => step(-1), stop };
}
