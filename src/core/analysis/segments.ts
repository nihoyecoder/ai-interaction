import type { ElementSample } from '../recording';
import { changedOnItsOwn, createScrollLookup } from '../recording-summary';
import type { RecordingData } from './types';

/** One element's run of changed frames, before it's interpreted. */
export interface RawSegment {
  element: number;
  /** The state just before the motion started. */
  before: ElementSample;
  /** Every frame in which the element changed, in time order. */
  samples: ElementSample[];
}

/** Changes closer together than this belong to the same motion. */
const GAP_MS = 100;

/** Splits each element's changes into separate motions, ignoring movement caused by page scrolling. */
export function findRawSegments(recording: RecordingData): RawSegment[] {
  const scrollAt = createScrollLookup(recording.scroll);
  const byElement = new Map<number, ElementSample[]>();
  for (const sample of recording.samples) {
    const list = byElement.get(sample.element) ?? [];
    list.push(sample);
    byElement.set(sample.element, list);
  }

  const segments: RawSegment[] = [];
  for (const [element, samples] of byElement) {
    let current: RawSegment | null = null;
    for (let index = 1; index < samples.length; index++) {
      const before = samples[index - 1];
      const sample = samples[index];
      if (!before || !sample || !changedOnItsOwn(before, sample, scrollAt(before.t), scrollAt(sample.t))) continue;
      const previous = current?.samples[current.samples.length - 1];
      if (current && previous && sample.t - previous.t <= GAP_MS) {
        current.samples.push(sample);
      } else {
        if (current) segments.push(current);
        current = { element, before, samples: [sample] };
      }
    }
    if (current) segments.push(current);
  }
  return segments.sort((a, b) => (a.samples[0]?.t ?? 0) - (b.samples[0]?.t ?? 0));
}
