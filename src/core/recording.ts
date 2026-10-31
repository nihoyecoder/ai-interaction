import type { ElementName } from './element-summary';

/** Recordings stop by themselves after this long. */
export const MAX_RECORDING_MS = 10_000;
/** How many of the selected element's visible descendants are tracked, besides the element itself. */
export const MAX_TRACKED_DESCENDANTS = 20;
/** How many separate scrolling areas (besides the page) are tracked. */
export const MAX_SCROLL_AREAS = 10;

export type StopReason = 'user' | 'time-limit' | 'tab-hidden' | 'nothing-selected';

export interface TrackedElement {
  name: ElementName;
  /** 0 for the selected element, 1 for its children, 2 for grandchildren, and so on. */
  depth: number;
}

/** One element's measured state in one frame. */
export interface ElementSample {
  t: number;
  /** Index into `Recording.elements`. */
  element: number;
  /** On-screen box in viewport coordinates, including transforms. */
  x: number;
  y: number;
  width: number;
  height: number;
  transform: string;
  opacity: number;
}

export interface PointerSample {
  t: number;
  x: number;
  y: number;
}

export interface ScrollSample {
  t: number;
  /** -1 for the page itself; otherwise an index into `Recording.scrollAreas`. */
  area: number;
  x: number;
  y: number;
}

/** The selected element started or stopped matching :hover. */
export interface HoverChange {
  t: number;
  hovered: boolean;
}

export interface PressEvent {
  t: number;
  type: 'press' | 'release';
  x: number;
  y: number;
  /** The press was on the selected element or inside it. */
  onElement: boolean;
}

/**
 * Everything measured during one recording. Times are milliseconds since the
 * recording started. Element samples are stored only when something changed,
 * so an element that stays still has a single sample.
 */
export interface Recording {
  durationMs: number;
  frameCount: number;
  stopReason: StopReason;
  viewport: { width: number; height: number };
  /** The selected element first, then the tracked descendants. */
  elements: TrackedElement[];
  scrollAreas: ElementName[];
  samples: ElementSample[];
  pointer: PointerSample[];
  scroll: ScrollSample[];
  startHovered: boolean;
  hover: HoverChange[];
  presses: PressEvent[];
}

export function createEmptyRecording(stopReason: StopReason): Recording {
  return {
    durationMs: 0,
    frameCount: 0,
    stopReason,
    viewport: { width: 0, height: 0 },
    elements: [],
    scrollAreas: [],
    samples: [],
    pointer: [],
    scroll: [],
    startHovered: false,
    hover: [],
    presses: [],
  };
}
