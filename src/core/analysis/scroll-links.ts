import type { AnimationRecord, StyleWrites } from '../recording';
import { createScrollLookup } from '../recording-summary';
import type { MotionProperty, RecordingData, ScrollLink, ScrollLinkedProperty } from './types';
import { readValues, roundTo, TOLERANCE, type SampleValues } from './values';

const MIN_SAMPLES = 6;
const MIN_SCROLL_PX = 30;
const CORRELATION = 0.95;
/** Scroll-driven CSS animations hold still outside their range, which weakens the correlation. */
const SCROLL_DRIVEN_CORRELATION = 0.8;
/** Scroll-linked motion only changes while the page scrolls. Time-based motion keeps going after. */
const SCROLLING_SHARE = 0.9;

/**
 * Elements whose motion follows the scroll position rather than time, such as
 * parallax and scroll-driven CSS animations. A value is linked when it rises
 * and falls in step with the scroll position and only changes while scrolling.
 * Elements with a time-based animation from Chrome's list are left out, because
 * their motion runs on time even if it happens during a scroll.
 */
export function findScrollLinks(input: {
  recording: RecordingData;
  movingElements: ReadonlySet<number>;
  animations: readonly AnimationRecord[];
  styleWrites: readonly StyleWrites[];
  subject: (element: number) => string;
}): ScrollLink[] {
  const { recording, animations, styleWrites, subject } = input;
  const scrollAt = createScrollLookup(recording.scroll);
  const pageScrollTimes = new Set(recording.scroll.filter((sample) => sample.area === -1).slice(1).map((sample) => sample.t));
  const depthOf = (element: number) => recording.elements[element]?.depth ?? 0;

  const links: ScrollLink[] = [];
  const elements = [...input.movingElements].sort((a, b) => depthOf(a) - depthOf(b));
  for (const element of elements) {
    if (animations.some((animation) => animation.element === element && !animation.scrollDriven)) continue;
    const samples = recording.samples.filter((sample) => sample.element === element).slice(1);
    if (samples.length < MIN_SAMPLES) continue;
    const scrollY = samples.map((sample) => scrollAt(sample.t).y);
    if (Math.max(...scrollY) - Math.min(...scrollY) < MIN_SCROLL_PX) continue;
    const whileScrolling = samples.filter((sample) => pageScrollTimes.has(sample.t)).length / samples.length;
    if (whileScrolling < SCROLLING_SHARE) continue;

    const animation = animations.find((candidate) => candidate.element === element && candidate.scrollDriven) ?? null;
    const threshold = animation ? SCROLL_DRIVEN_CORRELATION : CORRELATION;
    const series = samples.map((sample) => readValues(sample, scrollAt(sample.t)));
    const column = (key: keyof SampleValues) => series.map((values) => Number(values[key]));

    let properties = linked(scrollY, threshold, [
      ['translateX', column('translateX')],
      ['translateY', column('translateY')],
      ['rotate', column('rotate')],
      ['scale', column('scaleX')],
      ['opacity', column('opacity')],
    ]);
    // Movement without a transform, e.g. a script updating `top`. Not for elements inside one that's already
    // linked, because they just move along with it.
    const insideLinked = links.some((link) => depthOf(link.element) < depthOf(element));
    if (properties.length === 0 && !insideLinked) {
      const pageY = column('pageY');
      const pageX = column('pageX');
      properties = linked(scrollY, threshold, [
        ['moveY', pageY.map((value) => value - (pageY[0] ?? 0))],
        ['moveX', pageX.map((value) => value - (pageX[0] ?? 0))],
      ]);
    }
    if (properties.length === 0) continue;

    links.push({
      element,
      subject: subject(element),
      properties,
      mechanism: animation
        ? 'scroll-driven-animation'
        : styleWrites.some((writes) => writes.element === element && writes.count > 0)
          ? 'javascript'
          : 'unknown',
      animation,
    });
  }
  return links;
}

function linked(
  scrollY: readonly number[],
  threshold: number,
  candidates: ReadonlyArray<[MotionProperty, number[]]>,
): ScrollLinkedProperty[] {
  const properties: ScrollLinkedProperty[] = [];
  for (const [property, values] of candidates) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max - min <= TOLERANCE[property]) continue;
    const fit = linearFit(scrollY, values);
    if (!fit || Math.abs(fit.correlation) < threshold) continue;
    properties.push({ property, perPx: roundTo(fit.slope, 4), min: roundTo(min, 3), max: roundTo(max, 3) });
  }
  return properties;
}

/** Least-squares slope of y against x, and their correlation. Null when either doesn't vary. */
export function linearFit(xs: readonly number[], ys: readonly number[]): { slope: number; correlation: number } | null {
  const count = Math.min(xs.length, ys.length);
  if (count < 2) return null;
  let sumX = 0;
  let sumY = 0;
  for (let index = 0; index < count; index++) {
    sumX += xs[index] ?? 0;
    sumY += ys[index] ?? 0;
  }
  const meanX = sumX / count;
  const meanY = sumY / count;
  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;
  for (let index = 0; index < count; index++) {
    const dx = (xs[index] ?? 0) - meanX;
    const dy = (ys[index] ?? 0) - meanY;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }
  if (varianceX === 0 || varianceY === 0) return null;
  return { slope: covariance / varianceX, correlation: covariance / Math.sqrt(varianceX * varianceY) };
}
