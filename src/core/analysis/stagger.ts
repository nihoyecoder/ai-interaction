import type { MotionSegment, RecordingData, Stagger } from './types';

const MIN_ITEMS = 3;
/** Starts closer together than this are simultaneous, not staggered. */
const MIN_INTERVAL_MS = 20;

/**
 * Sibling inner elements that start moving one after another at a steady
 * interval. When Chrome reported their animations, the delays come straight
 * from it (observed). Otherwise the measured motion starts are used, which can
 * be off by about a frame.
 */
export function findStagger(segments: readonly MotionSegment[], recording: RecordingData, frameMs: number): Stagger | null {
  const firstMotion = new Map<number, MotionSegment>();
  for (const segment of segments) {
    if (segment.element === 0 || segment.instant || firstMotion.has(segment.element)) continue;
    firstMotion.set(segment.element, segment);
  }

  // Siblings only: the nesting depth with the most moving elements.
  const byDepth = new Map<number, MotionSegment[]>();
  for (const segment of firstMotion.values()) {
    const depth = recording.elements[segment.element]?.depth ?? 0;
    byDepth.set(depth, [...(byDepth.get(depth) ?? []), segment]);
  }
  const group = [...byDepth.values()].sort((a, b) => b.length - a.length)[0];
  if (!group || group.length < MIN_ITEMS) return null;
  group.sort((a, b) => a.element - b.element);

  const observed = group.every((segment) => segment.cause.animation && !segment.cause.animation.runningAtStart);
  const starts = group.map((segment) => {
    const animation = segment.cause.animation;
    return observed && animation ? animation.t + Math.max(0, animation.delayMs) : segment.start;
  });
  const gaps = starts.slice(1).map((start, index) => start - (starts[index] ?? start));
  const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? 0;
  if (Math.abs(median) < MIN_INTERVAL_MS) return null;

  const tolerance = Math.max(observed ? 5 : 2 * frameMs, Math.abs(median) * 0.15);
  const steady = gaps.every((gap) => Math.sign(gap) === Math.sign(median) && Math.abs(gap - median) <= tolerance);
  if (!steady) return null;

  return {
    count: group.length,
    intervalMs: Math.round(Math.abs(median)),
    order: median > 0 ? 'forward' : 'reverse',
    certainty: observed ? 'observed' : 'measured',
    subjects: group.map((segment) => segment.subject),
    elements: group.map((segment) => segment.element),
  };
}
