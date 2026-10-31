import { createElementName, type ElementName } from '@/core/element-summary';
import {
  capAttributeName,
  diffClasses,
  MAX_ANIMATION_RECORDS,
  MAX_CHANGE_RECORDS,
  MAX_RECORDING_MS,
  MAX_SCROLL_AREAS,
  MAX_TRACKED_DESCENDANTS,
  type AnimationRecord,
  type AttributeChange,
  type ClassChange,
  type ElementSample,
  type HoverChange,
  type PointerSample,
  type PressEvent,
  type Recording,
  type ScrollSample,
  type StopReason,
} from '@/core/recording';
import { readAnimation } from './animations';
import { visualChildrenOf } from './dom';
import { showRecordingIndicator } from './indicator';

export interface ActiveRecording {
  /** Stops and reports what was recorded. */
  stop(): void;
  /** Stops and throws the recording away, for example when the panel disconnects. */
  discard(): void;
}

type ElementState = Omit<ElementSample, 't' | 'element'>;

/**
 * Records how the selected element and its visible descendants change, and
 * what the user does, until stopped or for at most 10 seconds. The page keeps
 * working normally: nothing is blocked. Only times, coordinates, and sizes are
 * recorded, never keystrokes, form values, or page text.
 */
export function startRecording(selected: Element, onFinish: (recording: Recording) => void): ActiveRecording {
  const startTime = performance.now();
  const viewport = { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
  const tracked = [{ element: selected, depth: 0 }, ...visibleDescendants(selected, MAX_TRACKED_DESCENDANTS)];
  // Computed style objects are live, so each one is created once and read every frame.
  const computedStyles = tracked.map(({ element }) => getComputedStyle(element));
  const lastStates: Array<ElementState | null> = tracked.map(() => null);

  const samples: ElementSample[] = [];
  const pointer: PointerSample[] = [];
  const scroll: ScrollSample[] = [];
  const hover: HoverChange[] = [];
  const presses: PressEvent[] = [];
  const scrollAreas: Element[] = [];
  const scrolledSinceLastFrame = new Set<Element>();
  let latestPointer: { x: number; y: number } | null = null;
  let lastPageScroll: { x: number; y: number } | null = null;
  const startHovered = selected.matches(':hover');
  let hovered = startHovered;
  let frameCount = 0;
  let frame = 0;
  let finished = false;

  // Evidence of what caused the motion.
  const trackedIndex = new Map(tracked.map(({ element }, index) => [element, index]));
  const indexOf = (element: Element) => trackedIndex.get(element) ?? -1;
  const seenAnimations = new WeakSet<Animation>();
  const animations: AnimationRecord[] = [];
  const classChanges: ClassChange[] = [];
  const attributeChanges: AttributeChange[] = [];
  const styleWrites = new Map<Element, number>();
  const mutations = new MutationObserver((records) => recordMutations(records));

  const indicator = showRecordingIndicator();
  const listeners = new AbortController();
  const passive = { capture: true, passive: true, signal: listeners.signal };
  const sinceStart = (timeStamp: number) => Math.min(MAX_RECORDING_MS, Math.max(0, round(timeStamp - startTime, 1)));

  const recordPress = (type: PressEvent['type']) => (event: PointerEvent) => {
    presses.push({
      t: sinceStart(event.timeStamp),
      type,
      x: round(event.clientX, 1),
      y: round(event.clientY, 1),
      onElement: event.composedPath().includes(selected),
    });
  };

  window.addEventListener(
    'pointermove',
    (event) => {
      latestPointer = { x: event.clientX, y: event.clientY };
    },
    passive,
  );
  window.addEventListener('pointerdown', recordPress('press'), passive);
  window.addEventListener('pointerup', recordPress('release'), passive);
  // Scroll events on elements don't bubble, but a capturing listener on window still sees them.
  window.addEventListener(
    'scroll',
    (event) => {
      if (event.target instanceof Element) scrolledSinceLastFrame.add(event.target);
    },
    passive,
  );
  // Chrome pauses frame timing in hidden tabs, so leaving the tab ends the recording.
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) finish('tab-hidden');
    },
    { signal: listeners.signal },
  );

  /** Notes every animation on the element or inside it the first time it's seen. */
  function collectAnimations(t: number, atStart: boolean) {
    for (const animation of selected.getAnimations({ subtree: true })) {
      if (animations.length >= MAX_ANIMATION_RECORDS) return;
      if (seenAnimations.has(animation)) continue;
      seenAnimations.add(animation);
      const record = readAnimation(animation, t, atStart, indexOf);
      if (record) animations.push(record);
    }
  }

  /** Class names added or removed, other attributes' names, and inline-style change counts. */
  function recordMutations(records: MutationRecord[]) {
    const t = sinceStart(performance.now());
    const classRecords: MutationRecord[] = [];
    for (const record of records) {
      if (record.type !== 'attributes' || !(record.target instanceof Element) || !record.attributeName) continue;
      if (record.attributeName === 'style') {
        styleWrites.set(record.target, (styleWrites.get(record.target) ?? 0) + 1);
      } else if (record.attributeName === 'class') {
        classRecords.push(record);
      } else if (attributeChanges.length < MAX_CHANGE_RECORDS) {
        attributeChanges.push({ t, ...reference(record.target), name: capAttributeName(record.attributeName) });
      }
    }
    // Several class changes can arrive together. Each one ends where the next change to the same element begins.
    classRecords.forEach((record, index) => {
      const target = record.target as Element;
      const next = classRecords.slice(index + 1).find((later) => later.target === target);
      const after = next ? (next.oldValue ?? '') : (target.getAttribute('class') ?? '');
      const { added, removed } = diffClasses(record.oldValue ?? '', after);
      if ((added.length > 0 || removed.length > 0) && classChanges.length < MAX_CHANGE_RECORDS) {
        classChanges.push({ t, ...reference(target), added, removed });
      }
    });
  }

  function reference(element: Element) {
    return { element: indexOf(element), target: nameOf(element) };
  }

  /** Reads everything once. Stores only what changed since the previous frame. */
  function sample(t: number, atStart = false) {
    frameCount++;
    collectAnimations(t, atStart);

    const pageScroll = { x: round(window.scrollX, 1), y: round(window.scrollY, 1) };
    if (!lastPageScroll || pageScroll.x !== lastPageScroll.x || pageScroll.y !== lastPageScroll.y) {
      lastPageScroll = pageScroll;
      scroll.push({ t, area: -1, ...pageScroll });
    }
    for (const area of scrolledSinceLastFrame) {
      let index = scrollAreas.indexOf(area);
      if (index === -1) {
        if (scrollAreas.length >= MAX_SCROLL_AREAS) continue;
        index = scrollAreas.push(area) - 1;
      }
      scroll.push({ t, area: index, x: round(area.scrollLeft, 1), y: round(area.scrollTop, 1) });
    }
    scrolledSinceLastFrame.clear();

    if (latestPointer) {
      pointer.push({ t, x: round(latestPointer.x, 1), y: round(latestPointer.y, 1) });
      latestPointer = null;
    }

    const nowHovered = selected.matches(':hover');
    if (nowHovered !== hovered) {
      hovered = nowHovered;
      hover.push({ t, hovered });
    }

    tracked.forEach(({ element }, index) => {
      const rect = element.getBoundingClientRect();
      const computed = computedStyles[index];
      const state: ElementState = {
        x: round(rect.left, 2),
        y: round(rect.top, 2),
        width: round(rect.width, 2),
        height: round(rect.height, 2),
        transform: computed?.transform ?? 'none',
        opacity: Number(computed?.opacity ?? 1),
      };
      if (sameState(lastStates[index] ?? null, state)) return;
      lastStates[index] = state;
      samples.push({ t, element: index, ...state });
    });
  }

  function onFrame(now: number) {
    frame = 0;
    const t = Math.max(0, round(now - startTime, 1));
    if (t >= MAX_RECORDING_MS) {
      finish('time-limit');
      return;
    }
    sample(t);
    indicator.update(t);
    frame = requestAnimationFrame(onFrame);
  }

  function cleanUp() {
    listeners.abort();
    mutations.disconnect();
    cancelAnimationFrame(frame);
    indicator.destroy();
  }

  function finish(stopReason: StopReason) {
    if (finished) return;
    finished = true;
    recordMutations(mutations.takeRecords());
    cleanUp();
    onFinish({
      durationMs: stopReason === 'time-limit' ? MAX_RECORDING_MS : sinceStart(performance.now()),
      frameCount,
      stopReason,
      viewport,
      elements: tracked.map(({ element, depth }) => ({ name: nameOf(element), depth })),
      scrollAreas: scrollAreas.map((area) => nameOf(area)),
      samples,
      pointer,
      scroll,
      startHovered,
      hover,
      presses,
      animations,
      classChanges,
      attributeChanges,
      styleWrites: [...styleWrites]
        .map(([element, count]) => ({ ...reference(element), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_TRACKED_DESCENDANTS),
    });
  }

  // Watch the element and everything inside it. Old values are needed to tell which classes changed.
  mutations.observe(selected, { subtree: true, attributes: true, attributeOldValue: true });
  // A first sample right away records where everything started.
  sample(0, true);
  frame = requestAnimationFrame(onFrame);

  return {
    stop: () => finish('user'),
    discard: () => {
      if (finished) return;
      finished = true;
      cleanUp();
    },
  };
}

/**
 * Up to `max` descendants that have a box on the page, closest levels first.
 * Size is measured before transforms, so an element scaled to 0 (the start of
 * a "grow" animation) is still tracked. Elements hidden with `display: none`
 * aren't tracked.
 */
function visibleDescendants(root: Element, max: number): Array<{ element: Element; depth: number }> {
  const found: Array<{ element: Element; depth: number }> = [];
  let level = [root];
  for (let depth = 1; level.length > 0; depth++) {
    const next: Element[] = [];
    for (const parent of level) {
      for (const child of visualChildrenOf(parent)) {
        if (hasBox(child)) {
          found.push({ element: child, depth });
          if (found.length === max) return found;
        }
        next.push(child);
      }
    }
    level = next;
  }
  return found;
}

function hasBox(element: Element): boolean {
  if (element instanceof HTMLElement) return element.offsetWidth > 0 || element.offsetHeight > 0;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0;
}

function sameState(a: ElementState | null, b: ElementState): boolean {
  return (
    a !== null &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.transform === b.transform &&
    a.opacity === b.opacity
  );
}

function nameOf(element: Element): ElementName {
  return createElementName({ tag: element.localName, id: element.id, classes: Array.from(element.classList) });
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
