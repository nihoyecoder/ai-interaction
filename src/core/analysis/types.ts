import type { AnimationRecord, Recording } from '../recording';

/** The parts of a recording that analysis reads (the capture's `measured.recording`). */
export type RecordingData = Pick<
  Recording,
  'durationMs' | 'frameCount' | 'viewport' | 'elements' | 'samples' | 'scroll' | 'startHovered' | 'hover' | 'presses'
>;

/** How sure a trigger is. Triggers are inferred from timing, so they're always Estimated. */
export type Confidence = 'high' | 'medium' | 'low';

export type MotionProperty =
  | 'translateX'
  | 'translateY'
  | 'rotate'
  | 'skew'
  | 'scale'
  | 'scaleX'
  | 'scaleY'
  | 'opacity'
  | 'moveX'
  | 'moveY'
  | 'width'
  | 'height';

/** One property's measured change during a motion. */
export interface PropertyChange {
  property: MotionProperty;
  from: number;
  to: number;
  /** Lowest and highest values during the motion. They differ from `from` and `to` when it overshoots. */
  min: number;
  max: number;
  /** The value just before an instant jump to `from`, e.g. a delayed CSS animation applying its first keyframe. */
  jumpedFrom?: number;
  /** The value of an instant jump right after the motion, e.g. a script resetting the element. */
  jumpedTo?: number;
}

export type UserTrigger =
  | 'hover-start'
  | 'hover-end'
  | 'pointer-down'
  | 'click'
  | 'enters-viewport'
  | 'scroll'
  | 'none';

export type Mechanism =
  | 'css-transition'
  | 'css-animation'
  | 'web-animation'
  | 'scroll-driven-animation'
  | 'javascript'
  | 'unknown';

/** What started a motion, and how the page made it happen. */
export interface Cause {
  trigger: UserTrigger;
  /** When the user action happened, in ms. Null when there was none. */
  triggerAt: number | null;
  /** A class the page added or removed between the action and the motion. */
  classChange: { added: string[]; removed: string[]; at: number } | null;
  mechanism: Mechanism;
  /** The animation Chrome reported for this motion, when there is one. */
  animation: AnimationRecord | null;
  confidence: Confidence;
}

/** A known easing curve compared with a measured motion. */
export interface EasingMatch {
  /** For example "ease-out", "power3.out", or "spring". */
  name: string;
  /** The GSAP ease name, when there is one. */
  gsap: string | null;
  /** A CSS timing function: a keyword, or a cubic-bezier that approximates the curve. Null when CSS has no equivalent. */
  css: string | null;
  /** Root-mean-square difference from the measured curve, as a share of the motion (0.012 = 1.2%). */
  error: number;
  spring?: { dampingRatio: number };
}

/** The easing that best explains a measured motion. Always Estimated. */
export interface EasingFit {
  /** The property whose curve was fitted. */
  property: MotionProperty;
  /** close: within 2%. rough: within 5%. none: no common easing fits. */
  quality: 'close' | 'rough' | 'none';
  best: EasingMatch;
  /** When no common easing fits: the closest cubic-bezier curve, and the duration that fits it. */
  custom: { css: string; error: number; durationMs: number } | null;
  /** The motion's duration according to the best-fitting curve. Usually closer than counting frames. */
  durationMs: number;
}

/** One distinct motion of one element. */
export interface MotionSegment {
  element: number;
  /** "the element" for the selected element, otherwise the inner element's name. */
  subject: string;
  start: number;
  end: number;
  durationMs: number;
  /** Observed when Chrome reported the animation's duration; otherwise measured from the samples. */
  durationCertainty: 'observed' | 'measured';
  changes: PropertyChange[];
  /** A one-frame jump rather than a gradual motion. */
  instant: boolean;
  /** The recording stopped before the motion finished. */
  cutOff: boolean;
  /** The element had a real 3D transform, which isn't decoded yet. */
  has3dTransform: boolean;
  cause: Cause;
  /** The fitted easing, for motions whose easing Chrome didn't report (e.g. JavaScript animations). */
  easing: EasingFit | null;
}

export interface ScrollLinkedProperty {
  property: MotionProperty;
  /** How much the value changes per px the page scrolls down. */
  perPx: number;
  min: number;
  max: number;
}

/** Motion that follows the scroll position instead of time, such as parallax. */
export interface ScrollLink {
  element: number;
  subject: string;
  properties: ScrollLinkedProperty[];
  mechanism: Mechanism;
  animation: AnimationRecord | null;
}

/** Inner elements that start the same motion one after another. */
export interface Stagger {
  count: number;
  intervalMs: number;
  /** Forward: in page order. Reverse: last element first. */
  order: 'forward' | 'reverse';
  /** Observed when the delays come from Chrome's animation list; measured from motion starts otherwise. */
  certainty: 'observed' | 'measured';
  subjects: string[];
  /** The staggered elements' indexes, in page order. */
  elements: number[];
}

export interface InteractionAnalysis {
  /** One sentence describing the main interaction. */
  headline: string;
  segments: MotionSegment[];
  scrollLinks: ScrollLink[];
  stagger: Stagger | null;
  /** Inner elements that only moved because an element around them moved. */
  followers: number;
  notes: string[];
}
