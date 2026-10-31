import type { Capture } from '../capture';
import { formatElementName } from '../element-summary';
import { createScrollLookup } from '../recording-summary';
import { createCauseContext, findCause, type CauseContext } from './causes';
import { describeHeadline } from './describe';
import { findScrollLinks } from './scroll-links';
import { findRawSegments, type RawSegment } from './segments';
import { findStagger } from './stagger';
import { fitEasing } from './easing';
import type { EasingFit, InteractionAnalysis, MotionProperty, MotionSegment, PropertyChange, RecordingData } from './types';
import { BOX_PROPERTIES, computeChanges, readValues, TOLERANCE, TRANSFORM_PROPERTIES, type SampleValues } from './values';

/**
 * Turns a capture into an understanding of the interaction: what triggered it,
 * how each element moved, and whether inner elements were staggered. Pure
 * logic: the same capture always gives the same analysis.
 */
export function analyzeCapture(capture: Capture): InteractionAnalysis {
  if (!capture.measured) {
    return {
      headline: 'Record an interaction to analyze it.',
      segments: [],
      scrollLinks: [],
      stagger: null,
      followers: 0,
      notes: [],
    };
  }

  const recording = capture.measured.recording;
  const { animations, classChanges, styleWrites } = capture.observed;
  const frameMs = Math.min(50, Math.max(8, recording.durationMs / Math.max(1, recording.frameCount)));
  const subject = (element: number) => {
    const name = recording.elements[element]?.name;
    return element === 0 || !name ? 'the element' : formatElementName(name);
  };
  const depthOf = (element: number) => recording.elements[element]?.depth ?? 0;

  const raw = findRawSegments(recording);
  const scrollLinks = findScrollLinks({
    recording,
    movingElements: new Set(raw.filter((segment) => segment.samples.length > 1).map((segment) => segment.element)),
    animations,
    styleWrites,
    subject,
  });
  const linked = new Set(scrollLinks.map((link) => link.element));
  const context = createCauseContext(recording, { animations, classChanges, styleWrites }, frameMs);

  let segments = raw
    .filter((segment) => !linked.has(segment.element))
    .map((segment) => toSegment(segment, recording, context, frameMs, subject));

  // Inner elements that only moved or resized because an element around them was transformed,
  // resized, or scroll-linked are followers, not motions of their own.
  const leaders = segments.filter(
    (segment) =>
      segment.has3dTransform ||
      segment.changes.some(
        (change) => TRANSFORM_PROPERTIES.has(change.property) || change.property === 'width' || change.property === 'height',
      ),
  );
  const followers = new Set<number>();
  segments = segments.filter((segment) => {
    const boxOnly = segment.changes.length > 0 && segment.changes.every((change) => BOX_PROPERTIES.has(change.property));
    if (segment.element === 0 || !boxOnly) return true;
    const depth = depthOf(segment.element);
    const led =
      scrollLinks.some((link) => depthOf(link.element) < depth) ||
      leaders.some(
        (leader) =>
          depthOf(leader.element) < depth && leader.start <= segment.end + frameMs && segment.start <= leader.end + frameMs,
      );
    if (led) followers.add(segment.element);
    return !led;
  });

  // A delayed CSS animation first jumps to its starting keyframe. That jump belongs to the motion that follows.
  segments = segments.filter(
    (segment) =>
      !(
        segment.instant &&
        segment.cause.animation &&
        segments.some(
          (other) =>
            other !== segment &&
            !other.instant &&
            other.element === segment.element &&
            other.cause.animation === segment.cause.animation,
        )
      ),
  );

  const stagger = findStagger(segments, recording, frameMs);
  const notes: string[] = [];
  if (segments.some((segment) => segment.cutOff)) {
    notes.push('A motion was still running when the recording stopped, so its end values may be incomplete.');
  }
  if (segments.some((segment) => segment.has3dTransform)) {
    notes.push("Some motion uses a 3D transform, which isn't decoded yet.");
  }
  if (segments.some((segment) => !segment.instant && segment.durationCertainty === 'measured')) {
    notes.push(`Measured times come from screen updates, so they can be off by about one frame (${Math.round(frameMs)} ms).`);
  }

  return {
    headline: describeHeadline({ segments, scrollLinks, stagger }),
    segments,
    scrollLinks,
    stagger,
    followers: followers.size,
    notes,
  };
}

function toSegment(
  raw: RawSegment,
  recording: RecordingData,
  context: CauseContext,
  frameMs: number,
  subject: (element: number) => string,
): MotionSegment {
  const scrollAt = createScrollLookup(recording.scroll);
  const series = [raw.before, ...raw.samples].map((sample) => readValues(sample, scrollAt(sample.t)));
  const { changes, has3d, endsWithJump } = computeChanges(series);

  const first = raw.samples[0] ?? raw.before;
  const lastIndex = endsWithJump && raw.samples.length >= 2 ? raw.samples.length - 2 : raw.samples.length - 1;
  const last = raw.samples[lastIndex] ?? first;
  const instant = raw.samples.length === 1;
  const cause = findCause(raw.element, first.t, context);

  const { animation } = cause;
  const observedDuration =
    animation && !animation.runningAtStart && animation.durationMs !== null && animation.iterations !== null
      ? animation.durationMs * animation.iterations
      : null;

  // When Chrome reported the animation, its easing is known exactly; otherwise fit one.
  const easing = instant || animation ? null : fitSegmentEasing(raw, series, changes, frameMs);
  // Without an observed duration: the fitted curve's duration if one fits, else the frames, counting the
  // one before the first visible change.
  const fittedDuration = easing?.quality === 'none' ? easing.custom?.durationMs : easing?.durationMs;
  const measuredDuration = fittedDuration ?? Math.round(last.t - first.t + frameMs);

  return {
    element: raw.element,
    subject: subject(raw.element),
    start: first.t,
    end: last.t,
    durationMs: instant ? 0 : (observedDuration ?? measuredDuration),
    durationCertainty: !instant && observedDuration !== null ? 'observed' : 'measured',
    changes,
    instant,
    cutOff: !instant && last.t >= recording.durationMs - 2 * frameMs,
    has3dTransform: has3d,
    cause,
    easing,
  };
}

/** The property whose curve best shows the motion's easing: movement first, then size, rotation, and fading. */
const EASING_PROPERTIES: MotionProperty[] = [
  'translateY',
  'translateX',
  'moveY',
  'moveX',
  'scale',
  'rotate',
  'opacity',
  'width',
  'height',
  'scaleX',
  'scaleY',
  'skew',
];

const READ: Record<MotionProperty, (values: SampleValues, first: SampleValues) => number> = {
  translateX: (values) => values.translateX,
  translateY: (values) => values.translateY,
  rotate: (values) => values.rotate,
  skew: (values) => values.skew,
  scale: (values) => values.scaleX,
  scaleX: (values) => values.scaleX,
  scaleY: (values) => values.scaleY,
  opacity: (values) => values.opacity,
  moveX: (values, first) => values.pageX - first.pageX,
  moveY: (values, first) => values.pageY - first.pageY,
  width: (values) => values.width,
  height: (values) => values.height,
};

function fitSegmentEasing(
  raw: RawSegment,
  series: readonly SampleValues[],
  changes: readonly PropertyChange[],
  frameMs: number,
): EasingFit | null {
  const change = EASING_PROPERTIES.map((property) => changes.find((candidate) => candidate.property === property)).find(
    (candidate): candidate is PropertyChange =>
      candidate !== undefined && Math.abs(candidate.to - candidate.from) > TOLERANCE[candidate.property] * 4,
  );
  const first = series[0];
  if (!change || !first) return null;

  // Skip the resting state before the motion, and a reset jump after it.
  const times = raw.samples.map((sample) => sample.t);
  const values = series.slice(1).map((values) => READ[change.property](values, first));
  const count = change.jumpedTo !== undefined ? values.length - 1 : values.length;
  const span = change.to - change.from;
  const points = values.slice(0, count).map((value, index) => ({ t: times[index] ?? 0, p: (value - change.from) / span }));

  const fit = fitEasing(points, frameMs);
  return fit ? { property: change.property, ...fit } : null;
}
