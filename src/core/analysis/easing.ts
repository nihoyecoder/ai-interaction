import { formatNumber } from '../css-values';
import type { EasingFit, EasingMatch } from './types';

/** An easing curve: progress 0–1 over time 0–1. */
export type Ease = (u: number) => number;

interface NamedEasing {
  name: string;
  gsap: string | null;
  css: string | null;
  ease: Ease;
  spring?: { dampingRatio: number; omega: number };
}

/** A point on a measured motion: time in ms and progress (0 = start value, 1 = end value). */
export interface ProgressPoint {
  t: number;
  p: number;
}

/** Within 2% is a close match, within 5% a rough one. */
const CLOSE = 0.02;
const ROUGH = 0.05;
/** Curves this close in error count as a tie. The simpler, earlier one in the list wins. */
const TIE = 0.002;
/** Progress this small means the element hasn't really moved yet. */
const STILL = 0.001;

/** A CSS cubic-bezier() curve. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const bx = (s: number) => 3 * (1 - s) ** 2 * s * x1 + 3 * (1 - s) * s ** 2 * x2 + s ** 3;
  const by = (s: number) => 3 * (1 - s) ** 2 * s * y1 + 3 * (1 - s) * s ** 2 * y2 + s ** 3;
  const dx = (s: number) => 3 * (1 - s) ** 2 * x1 + 6 * (1 - s) * s * (x2 - x1) + 3 * s ** 2 * (1 - x2);
  return (u) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    // Find s where x(s) = u: Newton's method, then bisection as a fallback.
    let s = u;
    for (let step = 0; step < 8; step++) {
      const error = bx(s) - u;
      if (Math.abs(error) < 1e-7) return by(s);
      const slope = dx(s);
      if (Math.abs(slope) < 1e-6) break;
      s -= error / slope;
    }
    let low = 0;
    let high = 1;
    s = u;
    for (let step = 0; step < 30; step++) {
      if (bx(s) < u) low = s;
      else high = s;
      s = (low + high) / 2;
    }
    return by(s);
  };
}

/** An underdamped spring settling at 1. `omega` is its natural frequency in units of the whole duration. */
export function springEase(dampingRatio: number, omega: number): Ease {
  const damped = omega * Math.sqrt(1 - dampingRatio ** 2);
  const ratio = (dampingRatio * omega) / damped;
  return (u) => 1 - Math.exp(-dampingRatio * omega * u) * (Math.cos(damped * u) + ratio * Math.sin(damped * u));
}

const bezier = (x1: number, y1: number, x2: number, y2: number) => ({
  css: `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`,
  ease: cubicBezier(x1, y1, x2, y2),
});

const powerIn = (n: number): Ease => (u) => u ** n;
const powerOut = (n: number): Ease => (u) => 1 - (1 - u) ** n;
const powerInOut = (n: number): Ease => (u) => (u < 0.5 ? 2 ** (n - 1) * u ** n : 1 - (-2 * u + 2) ** n / 2);

const BACK = 1.70158;
const BACK_IN_OUT = BACK * 1.525;

type Curve = [number, number, number, number];

/** GSAP eases use their real formulas. The CSS cubic-bezier next to each is the usual approximation. */
const POWER_CURVES: Array<{ name: string; exponent: number; in: Curve; out: Curve; inOut: Curve }> = [
  { name: 'power1', exponent: 2, in: [0.11, 0, 0.5, 0], out: [0.5, 1, 0.89, 1], inOut: [0.45, 0, 0.55, 1] },
  { name: 'power2', exponent: 3, in: [0.32, 0, 0.67, 0], out: [0.33, 1, 0.68, 1], inOut: [0.65, 0, 0.35, 1] },
  { name: 'power3', exponent: 4, in: [0.5, 0, 0.75, 0], out: [0.25, 1, 0.5, 1], inOut: [0.76, 0, 0.24, 1] },
  { name: 'power4', exponent: 5, in: [0.64, 0, 0.78, 0], out: [0.22, 1, 0.36, 1], inOut: [0.83, 0, 0.17, 1] },
];

const GSAP_EASINGS: NamedEasing[] = POWER_CURVES.flatMap((curve) => [
  { name: `${curve.name}.out`, gsap: `${curve.name}.out`, css: bezier(...curve.out).css, ease: powerOut(curve.exponent) },
  { name: `${curve.name}.in`, gsap: `${curve.name}.in`, css: bezier(...curve.in).css, ease: powerIn(curve.exponent) },
  {
    name: `${curve.name}.inOut`,
    gsap: `${curve.name}.inOut`,
    css: bezier(...curve.inOut).css,
    ease: powerInOut(curve.exponent),
  },
]);

const OTHER_EASINGS: NamedEasing[] = [
  { name: 'sine.out', gsap: 'sine.out', css: bezier(0.61, 1, 0.88, 1).css, ease: (u) => Math.sin((u * Math.PI) / 2) },
  { name: 'sine.in', gsap: 'sine.in', css: bezier(0.12, 0, 0.39, 0).css, ease: (u) => 1 - Math.cos((u * Math.PI) / 2) },
  { name: 'sine.inOut', gsap: 'sine.inOut', css: bezier(0.37, 0, 0.63, 1).css, ease: (u) => -(Math.cos(Math.PI * u) - 1) / 2 },
  { name: 'expo.out', gsap: 'expo.out', css: bezier(0.16, 1, 0.3, 1).css, ease: (u) => (u >= 1 ? 1 : 1 - 2 ** (-10 * u)) },
  { name: 'expo.in', gsap: 'expo.in', css: bezier(0.7, 0, 0.84, 0).css, ease: (u) => (u <= 0 ? 0 : 2 ** (10 * u - 10)) },
  {
    name: 'expo.inOut',
    gsap: 'expo.inOut',
    css: bezier(0.87, 0, 0.13, 1).css,
    ease: (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? 2 ** (20 * u - 10) / 2 : (2 - 2 ** (-20 * u + 10)) / 2),
  },
  { name: 'circ.out', gsap: 'circ.out', css: bezier(0, 0.55, 0.45, 1).css, ease: (u) => Math.sqrt(1 - (u - 1) ** 2) },
  { name: 'circ.in', gsap: 'circ.in', css: bezier(0.55, 0, 1, 0.45).css, ease: (u) => 1 - Math.sqrt(1 - u ** 2) },
  {
    name: 'circ.inOut',
    gsap: 'circ.inOut',
    css: bezier(0.85, 0, 0.15, 1).css,
    ease: (u) => (u < 0.5 ? (1 - Math.sqrt(1 - (2 * u) ** 2)) / 2 : (Math.sqrt(1 - (-2 * u + 2) ** 2) + 1) / 2),
  },
  {
    name: 'back.out',
    gsap: 'back.out(1.7)',
    css: bezier(0.34, 1.56, 0.64, 1).css,
    ease: (u) => 1 + (BACK + 1) * (u - 1) ** 3 + BACK * (u - 1) ** 2,
  },
  { name: 'back.in', gsap: 'back.in(1.7)', css: bezier(0.36, 0, 0.66, -0.56).css, ease: (u) => (BACK + 1) * u ** 3 - BACK * u ** 2 },
  {
    name: 'back.inOut',
    gsap: 'back.inOut(1.7)',
    css: bezier(0.68, -0.6, 0.32, 1.6).css,
    ease: (u) =>
      u < 0.5
        ? ((2 * u) ** 2 * ((BACK_IN_OUT + 1) * 2 * u - BACK_IN_OUT)) / 2
        : ((2 * u - 2) ** 2 * ((BACK_IN_OUT + 1) * (u * 2 - 2) + BACK_IN_OUT) + 2) / 2,
  },
  {
    name: 'elastic.out',
    gsap: 'elastic.out(1, 0.3)',
    css: null,
    ease: (u) => (u <= 0 ? 0 : u >= 1 ? 1 : 2 ** (-10 * u) * Math.sin((u * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  },
  { name: 'bounce.out', gsap: 'bounce.out', css: null, ease: bounceOut },
];

/** CSS keywords first, so they win ties against GSAP names for the same shape. */
export const NAMED_EASINGS: readonly NamedEasing[] = [
  { name: 'linear', gsap: 'none', css: 'linear', ease: (u) => u },
  { name: 'ease', gsap: null, css: 'ease', ease: cubicBezier(0.25, 0.1, 0.25, 1) },
  { name: 'ease-out', gsap: null, css: 'ease-out', ease: cubicBezier(0, 0, 0.58, 1) },
  { name: 'ease-in', gsap: null, css: 'ease-in', ease: cubicBezier(0.42, 0, 1, 1) },
  { name: 'ease-in-out', gsap: null, css: 'ease-in-out', ease: cubicBezier(0.42, 0, 0.58, 1) },
  ...GSAP_EASINGS,
  ...OTHER_EASINGS,
];

function spring(dampingRatio: number, omega: number): NamedEasing {
  return { name: 'spring', gsap: null, css: null, ease: springEase(dampingRatio, omega), spring: { dampingRatio, omega } };
}

/** Springs from very bouncy to barely bouncy, at a range of speeds. The best one is refined afterwards. */
const COARSE_SPRINGS: NamedEasing[] = [];
for (let ratio = 1; ratio <= 9; ratio++) {
  for (let omega = 4; omega <= 40; omega += 4) COARSE_SPRINGS.push(spring(ratio / 10, omega));
}

/**
 * Finds the easing that best explains a measured motion.
 *
 * A motion's true start and end are uncertain. Frames only show it after it
 * began. Curves with slow starts or long tails make changes too small for
 * Chrome to report, so the first and last visible changes can be well inside
 * the real motion. Each curve is therefore scored at its best start and end
 * within a window around the visible ones, searched coarse then fine. The
 * winning start and end also give the motion's duration.
 */
export function fitEasing(points: readonly ProgressPoint[], frameMs: number): Omit<EasingFit, 'property'> | null {
  if (points.length < 4) return null;
  // Changes that didn't move it yet (for example a script resetting the element just before animating) don't
  // mark the start. The motion starts somewhere before the first point that actually moved.
  const firstT = points.find((point) => Math.abs(point.p) > STILL)?.t ?? points[0]?.t ?? 0;
  const lastT = points[points.length - 1]?.t ?? 0;
  const span = lastT - firstT;
  if (span < frameMs * 2) return null;
  const window: TimingWindow = {
    start: [firstT - Math.max(1.5 * frameMs, TIMING_SLACK * span), firstT],
    end: [lastT - frameMs, lastT + TIMING_SLACK * span],
    seeds: [
      [firstT - 0.5 * frameMs, lastT],
      [firstT - 0.5 * frameMs, lastT + 0.15 * span],
      [firstT - 0.15 * span, lastT],
      [firstT - 0.15 * span, lastT + 0.15 * span],
    ],
    span,
  };

  let best: { easing: NamedEasing; error: number; start: number; end: number } | null = null;
  for (const easing of [...NAMED_EASINGS, ...COARSE_SPRINGS]) {
    const result = bestTiming(points, easing.ease, window);
    if (!best || result.error < best.error - TIE) best = { easing, ...result };
  }
  if (!best) return null;
  if (best.easing.spring) best = refineSpring(points, best, window);

  const quality = best.error <= CLOSE ? 'close' : best.error <= ROUGH ? 'rough' : 'none';
  return {
    quality,
    best: toMatch(best.easing, best.error),
    custom: quality === 'none' ? fitCubicBezier(points, best.start, best.end, span) : null,
    // A spring has no fixed end: a faster spring over a longer time draws the same curve. So its duration is
    // measured from the frames, counting the one before the first visible change.
    durationMs: Math.round(best.easing.spring ? span + frameMs : best.end - best.start),
  };
}

/** How far beyond the visible changes the real start and end may lie, as a share of the visible motion. */
const TIMING_SLACK = 0.25;

interface TimingWindow {
  start: [number, number];
  end: [number, number];
  /** Starting guesses for [start, end]: near the visible changes, and further out for slow starts and long tails. */
  seeds: Array<[number, number]>;
  span: number;
}

/**
 * The start and end that fit `ease` best. From each seed, step start and end
 * downhill with smaller and smaller steps (down to 0.25 ms). Oscillating
 * curves like elastic only fit within a few ms of their true timing, which a
 * fixed grid can step right over.
 */
function bestTiming(
  points: readonly ProgressPoint[],
  ease: Ease,
  window: TimingWindow,
  seeds: ReadonlyArray<[number, number]> = window.seeds,
): { error: number; start: number; end: number } {
  const clampStart = (t: number) => Math.min(window.start[1], Math.max(window.start[0], t));
  const clampEnd = (t: number) => Math.min(window.end[1], Math.max(window.end[0], t));
  let best = { error: Number.POSITIVE_INFINITY, start: window.start[1], end: window.end[0] };
  for (const [seedStart, seedEnd] of seeds) {
    let current = { start: clampStart(seedStart), end: clampEnd(seedEnd), error: 0 };
    current.error = rmsError(points, ease, current.start, current.end);
    for (let step = window.span * 0.04; step >= 0.25; step /= 2) {
      let improved = true;
      while (improved) {
        improved = false;
        for (const [dStart, dEnd] of [
          [step, 0],
          [-step, 0],
          [0, step],
          [0, -step],
        ] as const) {
          const start = clampStart(current.start + dStart);
          const end = clampEnd(current.end + dEnd);
          if (end <= start || (start === current.start && end === current.end)) continue;
          const error = rmsError(points, ease, start, end);
          if (error < current.error - 1e-9) {
            current = { start, end, error };
            improved = true;
          }
        }
      }
    }
    if (current.error < best.error) best = current;
  }
  return best;
}

/** Fine-tunes the best spring's damping and speed around the coarse one, keeping its timing as the seed. */
function refineSpring(
  points: readonly ProgressPoint[],
  coarse: { easing: NamedEasing; error: number; start: number; end: number },
  window: TimingWindow,
): { easing: NamedEasing; error: number; start: number; end: number } {
  const { dampingRatio, omega } = coarse.easing.spring ?? { dampingRatio: 0.5, omega: 10 };
  let best = coarse;
  for (let ratio = dampingRatio - 0.05; ratio <= dampingRatio + 0.0501; ratio += 0.01) {
    for (let speed = omega - 2; speed <= omega + 2.01; speed += 0.5) {
      if (ratio <= 0.02 || ratio >= 0.98 || speed <= 1) continue;
      const easing = spring(ratio, speed);
      const result = bestTiming(points, easing.ease, window, [[best.start, best.end]]);
      if (result.error < best.error) best = { easing, ...result };
    }
  }
  return best;
}

function toMatch(easing: NamedEasing, error: number): EasingMatch {
  const rounded = Math.round(error * 1000) / 1000;
  if (easing.spring) {
    const dampingRatio = Math.round(easing.spring.dampingRatio * 100) / 100;
    return { name: 'spring', gsap: null, css: null, error: rounded, spring: { dampingRatio } };
  }
  return { name: easing.name, gsap: easing.gsap, css: easing.css, error: rounded };
}

/**
 * The cubic-bezier curve closest to the motion: a coarse grid of control
 * points, then a search that nudges the control points and the motion's start
 * and end together.
 */
function fitCubicBezier(
  points: readonly ProgressPoint[],
  start: number,
  end: number,
  span: number,
): { css: string; error: number } {
  // Parameters: x1, y1, x2, y2, start, end.
  const error = ([x1, y1, x2, y2, from, to]: number[]) =>
    (to ?? end) <= (from ?? start)
      ? Number.POSITIVE_INFINITY
      : rmsError(points, cubicBezier(x1 ?? 0, y1 ?? 0, x2 ?? 1, y2 ?? 1), from ?? start, to ?? end);
  let best = [0.25, 0.1, 0.25, 1, start, end];
  let bestError = error(best);
  for (const x1 of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
    for (const y1 of [-0.5, 0, 0.5, 1, 1.5]) {
      for (const x2 of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
        for (const y2 of [-0.5, 0, 0.5, 1, 1.5]) {
          const candidate = [x1, y1, x2, y2, start, end];
          const candidateError = error(candidate);
          if (candidateError < bestError) {
            best = candidate;
            bestError = candidateError;
          }
        }
      }
    }
  }
  // Nudge each parameter while it helps, with smaller and smaller steps. Times move in shares of the motion.
  for (let size = 0.1; size >= 0.0025; size /= 2) {
    let improved = true;
    while (improved) {
      improved = false;
      for (let index = 0; index < 6; index++) {
        for (const direction of [-1, 1]) {
          const candidate = [...best];
          const value = candidate[index] ?? 0;
          if (index >= 4) candidate[index] = value + direction * size * span;
          else if (index % 2 === 0) candidate[index] = Math.min(1, Math.max(0, value + direction * size));
          else candidate[index] = Math.min(2, Math.max(-1, value + direction * size));
          const candidateError = error(candidate);
          if (candidateError < bestError - 1e-6) {
            best = candidate;
            bestError = candidateError;
            improved = true;
          }
        }
      }
    }
  }
  return {
    css: `cubic-bezier(${best.slice(0, 4).map((value) => formatNumber(value, 2)).join(', ')})`,
    error: Math.round(bestError * 1000) / 1000,
  };
}

function rmsError(points: readonly ProgressPoint[], ease: Ease, start: number, end: number): number {
  let sum = 0;
  for (const { t, p } of points) {
    const u = Math.min(1, Math.max(0, (t - start) / (end - start)));
    sum += (ease(u) - p) ** 2;
  }
  return Math.sqrt(sum / points.length);
}

function steps(from: number, to: number, count: number): number[] {
  return Array.from({ length: count }, (_, index) => from + ((to - from) * index) / (count - 1));
}

function bounceOut(u: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (u < 1 / d) return n * u * u;
  if (u < 2 / d) return n * (u -= 1.5 / d) * u + 0.75;
  if (u < 2.5 / d) return n * (u -= 2.25 / d) * u + 0.9375;
  return n * (u -= 2.625 / d) * u + 0.984375;
}
