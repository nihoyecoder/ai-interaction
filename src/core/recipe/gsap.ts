import type { MotionProperty, PropertyChange } from '../analysis/types';
import { formatNumber } from '../css-values';

/** GSAP's names for our properties. Box movement is recreated with a transform, which animates smoothly. */
const GSAP_PROPERTY: Record<MotionProperty, string> = {
  translateX: 'x',
  translateY: 'y',
  moveX: 'x',
  moveY: 'y',
  rotate: 'rotation',
  skew: 'skewX',
  scale: 'scale',
  scaleX: 'scaleX',
  scaleY: 'scaleY',
  opacity: 'opacity',
  width: 'width',
  height: 'height',
};

const CSS_KEYWORD_CURVES: Record<string, string> = {
  ease: '0.25, 0.1, 0.25, 1',
  'ease-in': '0.42, 0, 1, 1',
  'ease-out': '0, 0, 0.58, 1',
  'ease-in-out': '0.42, 0, 0.58, 1',
};

/** A value as it appears in code: px values as numbers, angles in degrees, scale and opacity as is. */
export function codeNumber(property: MotionProperty, value: number): string {
  const decimals = property === 'opacity' ? 2 : property.startsWith('scale') ? 3 : 1;
  return formatNumber(value, decimals);
}

/** GSAP entries for one side of the changes, e.g. ["y: -8", "scale: 1.04"]. */
export function gsapEntries(changes: readonly PropertyChange[], side: 'from' | 'to'): string[] {
  return changes.map((change) => `${GSAP_PROPERTY[change.property]}: ${codeNumber(change.property, change[side])}`);
}

/** GSAP vars for one side of the changes, e.g. "{ y: -8, scale: 1.04 }". */
export function gsapVars(changes: readonly PropertyChange[], side: 'from' | 'to'): string {
  return `{ ${gsapEntries(changes, side).join(', ')} }`;
}

/** The unit a property's value is written in. */
export function unitOf(property: MotionProperty): string {
  if (property === 'rotate' || property === 'skew') return '°';
  if (property === 'opacity' || property.startsWith('scale')) return '';
  return ' px';
}

const TRANSFORM_FUNCTIONS: Record<string, (args: number[]) => string[] | null> = {
  translateX: ([x]) => (x === undefined ? null : [`x: ${formatNumber(x, 2)}`]),
  translateY: ([y]) => (y === undefined ? null : [`y: ${formatNumber(y, 2)}`]),
  translate: ([x, y = 0]) => (x === undefined ? null : [`x: ${formatNumber(x, 2)}`, `y: ${formatNumber(y, 2)}`]),
  scale: ([s]) => (s === undefined ? null : [`scale: ${formatNumber(s, 3)}`]),
  rotate: ([r]) => (r === undefined ? null : [`rotation: ${formatNumber(r, 2)}`]),
};

/**
 * GSAP vars for a simple CSS transform written in px, unitless scale, and deg,
 * e.g. "translateY(40px)" becomes "{ y: 40 }". Null for anything else, such as
 * percentages or matrices.
 */
export function gsapVarsForTransform(transform: string): string | null {
  const entries: string[] = [];
  let rest = transform.trim();
  for (const match of transform.matchAll(/([a-zA-Z]+)\(([^)]*)\)/g)) {
    const convert = TRANSFORM_FUNCTIONS[match[1] ?? ''];
    const args = (match[2] ?? '').split(',').map((arg) => arg.trim());
    if (!convert || !args.every((arg) => /^-?[\d.]+(px|deg)?$/.test(arg))) return null;
    const converted = convert(args.map((arg) => Number.parseFloat(arg)));
    if (!converted) return null;
    entries.push(...converted);
    rest = rest.replace(match[0], '').trim();
  }
  return entries.length > 0 && rest === '' ? `{ ${entries.join(', ')} }` : null;
}

/** A CSS transform for one side of the changes, e.g. "translateY(-8px) scale(1.04)", or "none". */
export function cssTransform(changes: readonly PropertyChange[], side: 'from' | 'to'): string {
  const get = (property: MotionProperty) => changes.find((change) => change.property === property)?.[side];
  const parts: string[] = [];
  const x = get('translateX') ?? get('moveX');
  const y = get('translateY') ?? get('moveY');
  if (x !== undefined && y !== undefined) parts.push(`translate(${codeNumber('translateX', x)}px, ${codeNumber('translateY', y)}px)`);
  else if (x !== undefined) parts.push(`translateX(${codeNumber('translateX', x)}px)`);
  else if (y !== undefined) parts.push(`translateY(${codeNumber('translateY', y)}px)`);
  const rotate = get('rotate');
  if (rotate !== undefined) parts.push(`rotate(${codeNumber('rotate', rotate)}deg)`);
  const skew = get('skew');
  if (skew !== undefined) parts.push(`skewX(${codeNumber('skew', skew)}deg)`);
  const scale = get('scale');
  const scaleX = get('scaleX');
  const scaleY = get('scaleY');
  if (scale !== undefined) parts.push(`scale(${codeNumber('scale', scale)})`);
  else if (scaleX !== undefined || scaleY !== undefined) {
    parts.push(`scale(${codeNumber('scaleX', scaleX ?? 1)}, ${codeNumber('scaleY', scaleY ?? 1)})`);
  }
  const identity = parts.every((part) => /^(translate[XY]?\(0px(, 0px)?\)|rotate\(0deg\)|skewX\(0deg\)|scale\(1(, 1)?\))$/.test(part));
  return parts.length === 0 || identity ? 'none' : parts.join(' ');
}

/** The CSS properties a transition needs to cover for these changes. */
export function transitionedProperties(changes: readonly PropertyChange[]): string[] {
  const properties = new Set<string>();
  for (const change of changes) {
    if (change.property === 'opacity') properties.add('opacity');
    else if (change.property === 'width' || change.property === 'height') properties.add(change.property);
    else properties.add('transform');
  }
  return [...properties];
}

/** CSS lines that set one side of the changes. */
export function cssDeclarations(changes: readonly PropertyChange[], side: 'from' | 'to'): string[] {
  const lines: string[] = [];
  if (changes.some((change) => change.property !== 'opacity' && change.property !== 'width' && change.property !== 'height')) {
    lines.push(`transform: ${cssTransform(changes, side)};`);
  }
  for (const change of changes) {
    if (change.property === 'opacity') lines.push(`opacity: ${codeNumber('opacity', change[side])};`);
    if (change.property === 'width' || change.property === 'height') {
      lines.push(`${change.property}: ${codeNumber(change.property, change[side])}px;`);
    }
  }
  return lines;
}

/**
 * How to express a CSS timing function in GSAP. "linear" is "none". Bezier
 * curves, including the CSS keywords, are exact through CustomEase. Anything
 * else (steps(), linear()) has no direct GSAP form.
 */
export function gsapEaseForCss(css: string): { code: string; customEase: string | null } | null {
  if (css === 'linear') return { code: "'none'", customEase: null };
  const keyword = CSS_KEYWORD_CURVES[css];
  const bezier = keyword ?? /^cubic-bezier\(([^)]+)\)$/.exec(css)?.[1]?.trim();
  if (!bezier) return null;
  return { code: 'capturedEase', customEase: bezier.replace(/\s+/g, '') };
}

/** Milliseconds as GSAP seconds: 300 → "0.3". */
export function seconds(ms: number): string {
  return formatNumber(ms / 1000, 3);
}

/** A CSS identifier for the selected element, from its first class or its tag. */
export function cssSelector(name: { tag: string; classes: readonly string[] }): string {
  const className = name.classes.find((candidate) => /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/.test(candidate));
  return className ? `.${className}` : name.tag;
}
