import type { ElementSample, Recording, ScrollSample, StopReason } from './recording';

export interface RecordingSummary {
  durationMs: number;
  frameCount: number;
  stopReason: StopReason;
  /** When the selected element changed on its own, not counting page scrolling. Null if it never did. */
  elementChange: { from: number; to: number } | null;
  changedDescendants: number;
  trackedDescendants: number;
  /** Total distance the page scrolled, in px. */
  pageScrollPx: number;
  /** How many other scrolling areas were scrolled. */
  scrolledAreas: number;
  clicks: number;
  hoverEnters: number;
}

/** Movements and size changes smaller than this (in px) are treated as rounding noise. */
const TOLERANCE_PX = 0.5;

/** Measured facts about a recording, for the summary shown after it stops. */
export function summarizeRecording(recording: Recording): RecordingSummary {
  const pageScroll = recording.scroll.filter((sample) => sample.area === -1);
  const scrollAt = (t: number) => latestAt(pageScroll, t);

  const changeTimes: number[][] = recording.elements.map(() => []);
  const previous = new Map<number, ElementSample>();
  for (const sample of recording.samples) {
    const before = previous.get(sample.element);
    previous.set(sample.element, sample);
    if (before && changedOnItsOwn(before, sample, scrollAt(before.t), scrollAt(sample.t))) {
      changeTimes[sample.element]?.push(sample.t);
    }
  }

  const [ownTimes = [], ...descendantTimes] = changeTimes;
  const firstChange = ownTimes[0];
  const lastChange = ownTimes[ownTimes.length - 1];

  return {
    durationMs: recording.durationMs,
    frameCount: recording.frameCount,
    stopReason: recording.stopReason,
    elementChange: firstChange !== undefined && lastChange !== undefined ? { from: firstChange, to: lastChange } : null,
    changedDescendants: descendantTimes.filter((times) => times.length > 0).length,
    trackedDescendants: descendantTimes.length,
    pageScrollPx: Math.round(scrollDistance(pageScroll)),
    scrolledAreas: new Set(recording.scroll.filter((sample) => sample.area >= 0).map((sample) => sample.area)).size,
    clicks: recording.presses.filter((press) => press.type === 'release').length,
    hoverEnters: recording.hover.filter((change) => change.hovered).length,
  };
}

/**
 * Whether an element changed by itself between two samples. A change in
 * transform, opacity, or size always counts. Movement counts only when it isn't
 * explained by page scrolling: normal elements move by minus the scroll
 * distance, and fixed or sticky ones don't move at all.
 */
function changedOnItsOwn(
  before: ElementSample,
  after: ElementSample,
  scrollBefore: { x: number; y: number },
  scrollAfter: { x: number; y: number },
): boolean {
  if (before.transform !== after.transform || before.opacity !== after.opacity) return true;
  if (!isNear(before.width, after.width) || !isNear(before.height, after.height)) return true;

  const dx = after.x - before.x;
  const dy = after.y - before.y;
  const stayedPut = isNear(dx, 0) && isNear(dy, 0);
  const followedScroll = isNear(dx, -(scrollAfter.x - scrollBefore.x)) && isNear(dy, -(scrollAfter.y - scrollBefore.y));
  return !stayedPut && !followedScroll;
}

/** The most recent sample at or before `t`. Samples are in time order. */
function latestAt(samples: readonly ScrollSample[], t: number): { x: number; y: number } {
  let low = 0;
  let high = samples.length - 1;
  let found: ScrollSample | undefined;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const sample = samples[middle];
    if (sample && sample.t <= t) {
      found = sample;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found ?? samples[0] ?? { x: 0, y: 0 };
}

function scrollDistance(samples: readonly ScrollSample[]): number {
  let distance = 0;
  for (let index = 1; index < samples.length; index++) {
    const before = samples[index - 1];
    const after = samples[index];
    if (before && after) distance += Math.abs(after.x - before.x) + Math.abs(after.y - before.y);
  }
  return distance;
}

function isNear(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE_PX;
}
