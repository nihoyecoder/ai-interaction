import { INITIAL_STYLE_VALUES, type ElementSnapshot, type SnapshotProperty, type StyleValues } from './element-snapshot';
import { formatAnimation, formatTransition, readAnimations, readTransitions } from './motion';
import { decodeTransform, describeTransformOrigin, formatTransform } from './transform';

export interface StyleRow {
  label: string;
  value: string;
  /** Extra context, such as the raw matrix a transform was decoded from. */
  note?: string;
}

export interface StyleGroup {
  title: 'Layout' | 'Transform' | 'Appearance' | 'Motion';
  rows: StyleRow[];
}

const RADIUS_PROPERTIES = [
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
] as const;

/**
 * The details card's style groups. Keeps only values that differ from the
 * browser's defaults for this kind of element. `defaults` comes from an unstyled
 * element of the same type; missing values fall back to CSS initial values.
 */
export function describeStyles(snapshot: ElementSnapshot, defaults: Partial<StyleValues>): StyleGroup[] {
  const { styles } = snapshot;
  const differs = (property: SnapshotProperty) => {
    const value = styles[property];
    return value !== '' && value !== (defaults[property] ?? INITIAL_STYLE_VALUES[property]);
  };
  const row = (label: string, property: SnapshotProperty): StyleRow => ({ label, value: styles[property] });

  const layout: StyleRow[] = [];
  if (differs('display')) layout.push(row('Display', 'display'));
  if (differs('position')) layout.push(row('Position', 'position'));
  if (differs('overflow-x') || differs('overflow-y')) layout.push(overflowRow(styles));
  if (differs('z-index')) layout.push(row('Z-index', 'z-index'));

  const transform: StyleRow[] = [];
  if (differs('transform')) transform.push(transformRow(styles.transform));
  if (differs('translate')) transform.push(row('Translate', 'translate'));
  if (differs('rotate')) transform.push(row('Rotate', 'rotate'));
  if (differs('scale')) transform.push(row('Scale', 'scale'));
  const origin = describeTransformOrigin(styles['transform-origin'], snapshot.layoutSize);
  if (!origin.isDefault) transform.push({ label: 'Origin', value: origin.text });
  if (differs('perspective')) transform.push(row('Perspective', 'perspective'));

  const appearance: StyleRow[] = [];
  if (differs('opacity')) appearance.push(row('Opacity', 'opacity'));
  if (differs('filter')) appearance.push(row('Filter', 'filter'));
  if (differs('clip-path')) appearance.push(row('Clip path', 'clip-path'));
  if (RADIUS_PROPERTIES.some(differs)) appearance.push(radiusRow(styles));

  const motion: StyleRow[] = [
    ...readTransitions(styles).map((transition) => ({ label: 'Transition', value: formatTransition(transition) })),
    ...readAnimations(styles).map((animation) => ({ label: 'Animation', value: formatAnimation(animation) })),
  ];

  const groups: StyleGroup[] = [
    { title: 'Layout', rows: layout },
    { title: 'Transform', rows: transform },
    { title: 'Appearance', rows: appearance },
    { title: 'Motion', rows: motion },
  ];
  return groups.filter((group) => group.rows.length > 0);
}

function transformRow(value: string): StyleRow {
  const decoded = decodeTransform(value);
  if (decoded) return { label: 'Transform', value: formatTransform(decoded), note: `Decoded from ${value}` };
  if (value.startsWith('matrix3d(')) {
    return { label: 'Transform', value: '3D transform', note: `${value} (3D transforms aren't decoded yet)` };
  }
  return { label: 'Transform', value };
}

function overflowRow(styles: StyleValues): StyleRow {
  const x = styles['overflow-x'];
  const y = styles['overflow-y'];
  return { label: 'Overflow', value: x === y ? x : `x ${x} · y ${y}` };
}

/** One value when all four corners match; otherwise top-left, top-right, bottom-right, bottom-left. */
function radiusRow(styles: StyleValues): StyleRow {
  const corners = RADIUS_PROPERTIES.map((property) => styles[property]);
  const allSame = corners.every((corner) => corner === corners[0]);
  return { label: 'Corner radius', value: allSame ? (corners[0] ?? '') : corners.join(' ') };
}
