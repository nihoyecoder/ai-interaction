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
  /** CSS transitions, CSS animations, and Web Animations seen on the element or inside it. */
  animations: AnimationRecord[];
  classChanges: ClassChange[];
  attributeChanges: AttributeChange[];
  /** How often each element's inline style changed. Values aren't stored. */
  styleWrites: StyleWrites[];
}

/** Changes on elements inside the selected one that aren't among the tracked elements use -1. */
interface ElementReference {
  /** Index into `Recording.elements`, or -1 if the element isn't tracked. */
  element: number;
  target: ElementName;
}

export interface AnimationRecord extends ElementReference {
  /** When it was first seen running, in ms since the recording started. */
  t: number;
  /** It was already running when the recording started, e.g. a loop or a scroll-driven animation. */
  runningAtStart: boolean;
  kind: 'css-transition' | 'css-animation' | 'web-animation';
  /** The transition's property, the CSS animation's name, or the Web Animation's id (often empty). */
  name: string;
  /** For example "::before" when the animation runs on a pseudo-element. */
  pseudo: string | null;
  /** Null when it isn't a time, e.g. "auto" for scroll-driven animations. */
  durationMs: number | null;
  delayMs: number;
  easing: string;
  /** Null means it repeats forever. */
  iterations: number | null;
  direction: string;
  fill: string;
  /** Runs on a scroll or view timeline instead of time. */
  scrollDriven: boolean;
  keyframes: KeyframeRecord[];
}

export interface KeyframeRecord {
  offset: number | null;
  easing: string;
  /** Animated property values at this keyframe, e.g. { transform: "translateY(16px)" }. */
  values: Record<string, string>;
}

export interface ClassChange extends ElementReference {
  t: number;
  added: string[];
  removed: string[];
}

/** An attribute other than class or style changed. Only its name is kept, never its value. */
export interface AttributeChange extends ElementReference {
  t: number;
  name: string;
}

export interface StyleWrites extends ElementReference {
  count: number;
}

export const MAX_ANIMATION_RECORDS = 100;
export const MAX_CHANGE_RECORDS = 200;
const MAX_KEYFRAMES = 10;
const MAX_KEYFRAME_VALUES = 10;
const MAX_TEXT_LENGTH = 120;
const MAX_NAME_LENGTH = 60;
const MAX_CLASS_TOKENS = 10;
const MAX_CLASS_LENGTH = 40;

/** Builds an animation record from what Chrome reports, capping everything that came from the page. */
export function createAnimationRecord(raw: {
  t: number;
  runningAtStart: boolean;
  element: number;
  target: ElementName;
  kind: AnimationRecord['kind'];
  name: string;
  pseudo: string | null;
  duration: unknown;
  delay: number;
  easing: string;
  iterations: number;
  direction: string;
  fill: string;
  scrollDriven: boolean;
  keyframes: ReadonlyArray<Record<string, unknown>>;
}): AnimationRecord {
  return {
    t: raw.t,
    runningAtStart: raw.runningAtStart,
    element: raw.element,
    target: raw.target,
    kind: raw.kind,
    name: truncate(raw.name, MAX_NAME_LENGTH),
    pseudo: raw.pseudo,
    durationMs: typeof raw.duration === 'number' && Number.isFinite(raw.duration) ? raw.duration : null,
    delayMs: raw.delay,
    easing: truncate(raw.easing, MAX_TEXT_LENGTH),
    iterations: Number.isFinite(raw.iterations) ? raw.iterations : null,
    direction: raw.direction,
    fill: raw.fill,
    scrollDriven: raw.scrollDriven,
    keyframes: raw.keyframes.slice(0, MAX_KEYFRAMES).map(toKeyframeRecord),
  };
}

const KEYFRAME_META = new Set(['offset', 'computedOffset', 'easing', 'composite']);

function toKeyframeRecord(keyframe: Record<string, unknown>): KeyframeRecord {
  const values: Record<string, string> = {};
  for (const [property, value] of Object.entries(keyframe)) {
    if (KEYFRAME_META.has(property) || Object.keys(values).length >= MAX_KEYFRAME_VALUES) continue;
    if (typeof value === 'string' || typeof value === 'number') values[property] = truncate(String(value), MAX_TEXT_LENGTH);
  }
  const offset = keyframe.offset ?? keyframe.computedOffset;
  return {
    offset: typeof offset === 'number' ? offset : null,
    easing: typeof keyframe.easing === 'string' ? keyframe.easing : 'linear',
    values,
  };
}

/** The class names added and removed between two `class` attribute values. */
export function diffClasses(before: string, after: string): { added: string[]; removed: string[] } {
  const beforeTokens = new Set(before.split(/\s+/).filter(Boolean));
  const afterTokens = new Set(after.split(/\s+/).filter(Boolean));
  const cap = (tokens: string[]) => tokens.slice(0, MAX_CLASS_TOKENS).map((token) => truncate(token, MAX_CLASS_LENGTH));
  return {
    added: cap([...afterTokens].filter((token) => !beforeTokens.has(token))),
    removed: cap([...beforeTokens].filter((token) => !afterTokens.has(token))),
  };
}

export function capAttributeName(name: string): string {
  return truncate(name, MAX_NAME_LENGTH);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
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
    animations: [],
    classChanges: [],
    attributeChanges: [],
    styleWrites: [],
  };
}
