import { formatNumber } from './css-values';

/** A 2D transform split into parts a person can read. Angles are in degrees, translation in px. */
export interface DecodedTransform {
  translateX: number;
  translateY: number;
  rotate: number;
  skewX: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Chrome reports any 2D transform as `matrix(a, b, c, d, e, f)`. This splits it
 * into translate · rotate · skewX · scale, which recreates the same matrix in
 * that order. It's one equivalent way to write the transform, not necessarily
 * the one the site's code used. A `matrix3d` that's really flat (like GSAP's
 * `translate3d(x, y, 0)`) is decoded the same way. Returns null for "none" and
 * for true 3D matrices.
 */
export function decodeTransform(value: string): DecodedTransform | null {
  const flat = flatMatrix(value.trim());
  if (!flat) return null;
  const [a, b, c, d, e, f] = flat;

  let scaleX = Math.hypot(a, b);
  if (scaleX === 0) {
    // Scaled to zero on x, e.g. the start of a "grow from nothing" animation. Rotation can't be recovered.
    return { translateX: e, translateY: f, rotate: 0, skewX: 0, scaleX: 0, scaleY: Math.hypot(c, d) };
  }
  const determinant = a * d - b * c;
  let rotate = toDegrees(Math.atan2(b, a));
  let scaleY = determinant / scaleX;
  const skewX = determinant === 0 ? 0 : toDegrees(Math.atan((a * c + b * d) / determinant));

  // A mirrored transform can be written two ways. Prefer the one with the smaller rotation.
  if (determinant < 0 && Math.abs(rotate) > 90) {
    rotate = normalizeDegrees(rotate - 180);
    scaleX = -scaleX;
    scaleY = -scaleY;
  }
  return { translateX: e, translateY: f, rotate, skewX, scaleX, scaleY };
}

/** For example "translate 0px, -40px · rotate -9° · scale 0.82". */
export function formatTransform(transform: DecodedTransform): string {
  const { translateX, translateY, rotate, skewX, scaleX, scaleY } = transform;
  const parts: string[] = [];
  if (!isNear(translateX, 0) || !isNear(translateY, 0)) {
    parts.push(`translate ${formatNumber(translateX, 2)}px, ${formatNumber(translateY, 2)}px`);
  }
  if (!isNear(rotate, 0)) parts.push(`rotate ${formatNumber(rotate, 2)}°`);
  if (!isNear(skewX, 0)) parts.push(`skew ${formatNumber(skewX, 2)}°`);
  if (!isNear(scaleX, 1, SCALE_TOLERANCE) || !isNear(scaleY, 1, SCALE_TOLERANCE)) {
    parts.push(
      isNear(scaleX, scaleY, SCALE_TOLERANCE)
        ? `scale ${formatNumber(scaleX, 3)}`
        : `scale ${formatNumber(scaleX, 3)}, ${formatNumber(scaleY, 3)}`,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : 'none (no visible change)';
}

/**
 * Reads a computed transform-origin, such as "160px 240px" with an optional z
 * value. HTML elements (and an outer <svg>) default to their center; other SVG
 * elements default to 0 0. `layoutSize` is the untransformed box size, or null
 * for SVG elements inside an <svg>.
 */
export function describeTransformOrigin(
  value: string,
  layoutSize: { width: number; height: number } | null,
): { isDefault: boolean; text: string } {
  if (value.trim() === '') return { isDefault: true, text: '' };
  const [x, y, z = 0] = value
    .trim()
    .split(/\s+/)
    .map((part) => (part.endsWith('px') ? Number(part.slice(0, -2)) : Number.NaN));
  if (x === undefined || y === undefined || ![x, y, z].every(Number.isFinite)) {
    return { isDefault: false, text: value };
  }

  const zText = isNear(z, 0) ? '' : ` · z ${formatNumber(z, 2)}px`;
  const pxText = `${formatNumber(x, 2)}px ${formatNumber(y, 2)}px`;
  if (!layoutSize) {
    return { isDefault: isNear(x, 0) && isNear(y, 0) && isNear(z, 0), text: `${pxText}${zText}` };
  }

  const { width, height } = layoutSize;
  const isDefault = Math.abs(x - width / 2) <= 1 && Math.abs(y - height / 2) <= 1 && isNear(z, 0);
  if (width <= 0 || height <= 0) return { isDefault, text: `${pxText}${zText}` };
  return { isDefault, text: `${originWords(Math.round((x / width) * 100), Math.round((y / height) * 100))}${zText}` };
}

type FlatMatrix = [number, number, number, number, number, number];

/** The 2D matrix (a, b, c, d, e, f) from `matrix(...)`, or from a `matrix3d(...)` with no 3D part. */
function flatMatrix(value: string): FlatMatrix | null {
  const match = /^(matrix|matrix3d)\(([^)]*)\)$/.exec(value);
  if (!match?.[2]) return null;
  const numbers = match[2].split(',').map((part) => Number(part.trim()));
  if (!numbers.every(Number.isFinite)) return null;
  if (match[1] === 'matrix') return numbers.length === 6 ? (numbers as FlatMatrix) : null;
  if (numbers.length !== 16) return null;
  // Column-major: a b 0 0 / c d 0 0 / 0 0 1 0 / e f 0 1 is a flat transform.
  const isFlat = [2, 3, 6, 7, 8, 9, 11, 14].every((index) => Math.abs(numbers[index] ?? 1) < 1e-6) &&
    Math.abs((numbers[10] ?? 0) - 1) < 1e-6 &&
    Math.abs((numbers[15] ?? 0) - 1) < 1e-6;
  if (!isFlat) return null;
  return [numbers[0] ?? 1, numbers[1] ?? 0, numbers[4] ?? 0, numbers[5] ?? 1, numbers[12] ?? 0, numbers[13] ?? 0];
}

const SCALE_TOLERANCE = 0.0005;
const X_WORDS: Readonly<Record<number, string>> = { 0: 'left', 50: 'center', 100: 'right' };
const Y_WORDS: Readonly<Record<number, string>> = { 0: 'top', 50: 'center', 100: 'bottom' };

/** "top left", "bottom center", "center", or percentages for other points. */
function originWords(xPercent: number, yPercent: number): string {
  const xWord = X_WORDS[xPercent];
  const yWord = Y_WORDS[yPercent];
  if (!xWord || !yWord) return `${xPercent}% ${yPercent}%`;
  if (xWord === 'center' && yWord === 'center') return 'center';
  if (yWord === 'center') return `${xWord} center`;
  if (xWord === 'center') return `${yWord} center`;
  return `${yWord} ${xWord}`;
}

function isNear(a: number, b: number, tolerance = 0.005): boolean {
  return Math.abs(a - b) <= tolerance;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Keeps an angle within -180° to 180°. */
function normalizeDegrees(degrees: number): number {
  const wrapped = ((degrees + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
}
