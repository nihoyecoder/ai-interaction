import type { ElementSample } from '../recording';
import { decodeTransform, type DecodedTransform } from '../transform';
import type { MotionProperty, PropertyChange } from './types';

/** A sample's state in readable numbers. */
export interface SampleValues {
  transform: string;
  /** The transform is truly 3D, so its parts below are left at identity. */
  is3d: boolean;
  translateX: number;
  translateY: number;
  rotate: number;
  skew: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  /** Position in page coordinates, so page scrolling doesn't look like movement. */
  pageX: number;
  pageY: number;
  width: number;
  height: number;
}

/** Changes smaller than this are rounding noise. */
export const TOLERANCE: Readonly<Record<MotionProperty, number>> = {
  translateX: 0.5,
  translateY: 0.5,
  moveX: 0.5,
  moveY: 0.5,
  width: 0.5,
  height: 0.5,
  rotate: 0.1,
  skew: 0.1,
  scale: 0.001,
  scaleX: 0.001,
  scaleY: 0.001,
  opacity: 0.005,
};

const DECIMALS: Readonly<Record<MotionProperty, number>> = {
  translateX: 2,
  translateY: 2,
  moveX: 2,
  moveY: 2,
  width: 2,
  height: 2,
  rotate: 2,
  skew: 2,
  scale: 3,
  scaleX: 3,
  scaleY: 3,
  opacity: 3,
};

export const TRANSFORM_PROPERTIES: ReadonlySet<MotionProperty> = new Set([
  'translateX',
  'translateY',
  'rotate',
  'skew',
  'scale',
  'scaleX',
  'scaleY',
]);
export const BOX_PROPERTIES: ReadonlySet<MotionProperty> = new Set(['moveX', 'moveY', 'width', 'height']);

const IDENTITY: DecodedTransform = { translateX: 0, translateY: 0, rotate: 0, skewX: 0, scaleX: 1, scaleY: 1 };

export function readValues(sample: ElementSample, scroll: { x: number; y: number }): SampleValues {
  const decoded = sample.transform === 'none' ? IDENTITY : decodeTransform(sample.transform);
  const parts = decoded ?? IDENTITY;
  return {
    transform: sample.transform,
    is3d: decoded === null,
    translateX: parts.translateX,
    translateY: parts.translateY,
    rotate: parts.rotate,
    skew: parts.skewX,
    scaleX: parts.scaleX,
    scaleY: parts.scaleY,
    opacity: sample.opacity,
    pageX: sample.x + scroll.x,
    pageY: sample.y + scroll.y,
    width: sample.width,
    height: sample.height,
  };
}

/**
 * What changed across a motion. `series` starts with the state just before the
 * motion, followed by every changed frame. Box movement and resizing are only
 * reported when no transform explains them, because transforms move and resize
 * the on-screen box too.
 */
export function computeChanges(series: readonly SampleValues[]): {
  changes: PropertyChange[];
  has3d: boolean;
  endsWithJump: boolean;
} {
  const has3d = series.some((values) => values.is3d) && new Set(series.map((values) => values.transform)).size > 1;
  const changes: PropertyChange[] = [];
  const add = (property: MotionProperty, values: number[]) => {
    const change = describeChange(property, values);
    if (change) changes.push(change);
  };
  const column = (key: Exclude<keyof SampleValues, 'transform' | 'is3d'>) => series.map((values) => values[key]);

  if (!has3d) {
    add('translateX', column('translateX'));
    add('translateY', column('translateY'));
    add('rotate', column('rotate'));
    add('skew', column('skew'));
    const scaleX = column('scaleX');
    const scaleY = column('scaleY');
    if (scaleX.every((value, index) => Math.abs(value - (scaleY[index] ?? value)) <= TOLERANCE.scale)) {
      add('scale', scaleX);
    } else {
      add('scaleX', scaleX);
      add('scaleY', scaleY);
    }
  }
  add('opacity', column('opacity'));

  const transformed = has3d || changes.some((change) => TRANSFORM_PROPERTIES.has(change.property));
  if (!transformed) {
    const pageX = column('pageX');
    const pageY = column('pageY');
    const startX = pageX[0] ?? 0;
    const startY = pageY[0] ?? 0;
    add('moveX', pageX.map((value) => value - startX));
    add('moveY', pageY.map((value) => value - startY));
    add('width', column('width'));
    add('height', column('height'));
  }

  return { changes, has3d, endsWithJump: changes.some((change) => change.jumpedTo !== undefined) };
}

function describeChange(property: MotionProperty, values: readonly number[]): PropertyChange | null {
  const tolerance = TOLERANCE[property];
  if (values.length < 2) return null;

  let first = 0;
  let last = values.length - 1;
  // An instant jump before the motion: the first step is far bigger than the next one.
  if (values.length >= 3 && isJump(values[0], values[1], values[2], tolerance)) first = 1;
  // An instant jump after the motion, e.g. a script resetting the element when it's done.
  if (last - first >= 2 && isJump(values[last], values[last - 1], values[last - 2], tolerance)) last -= 1;

  const motion = values.slice(first, last + 1);
  const from = motion[0] ?? 0;
  const to = motion[motion.length - 1] ?? from;
  const min = Math.min(...motion);
  const max = Math.max(...motion);
  const jumpedFrom = first === 1 ? values[0] : undefined;
  const jumpedTo = last < values.length - 1 ? values[values.length - 1] : undefined;

  const moved = Math.abs(to - from) > tolerance || max - min > tolerance;
  if (!moved && jumpedFrom === undefined && jumpedTo === undefined) return null;

  const round = (value: number) => roundTo(value, DECIMALS[property]);
  return {
    property,
    from: round(from),
    to: round(to),
    min: round(min),
    max: round(max),
    ...(jumpedFrom !== undefined ? { jumpedFrom: round(jumpedFrom) } : {}),
    ...(jumpedTo !== undefined ? { jumpedTo: round(jumpedTo) } : {}),
  };
}

/** The step a → b is an instant jump when it's far bigger than the step b → c. */
function isJump(a: number | undefined, b: number | undefined, c: number | undefined, tolerance: number): boolean {
  if (a === undefined || b === undefined || c === undefined) return false;
  const jump = Math.abs(b - a);
  return jump > tolerance && jump > 4 * Math.abs(c - b);
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}
