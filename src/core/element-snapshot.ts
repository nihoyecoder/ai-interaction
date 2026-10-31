import { createElementName, createElementSummary, type ElementName, type ElementSummary } from './element-summary';

/**
 * Computed styles the inspector reads from the selected element: the ones
 * that matter most for motion. The details card groups them.
 */
export const SNAPSHOT_PROPERTIES = [
  'display',
  'position',
  'overflow-x',
  'overflow-y',
  'z-index',
  'transform',
  'translate',
  'rotate',
  'scale',
  'transform-origin',
  'perspective',
  'opacity',
  'filter',
  'clip-path',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'transition-property',
  'transition-duration',
  'transition-timing-function',
  'transition-delay',
  'animation-name',
  'animation-duration',
  'animation-timing-function',
  'animation-delay',
  'animation-iteration-count',
  'animation-direction',
  'animation-fill-mode',
  'animation-play-state',
  'animation-timeline',
] as const;

export type SnapshotProperty = (typeof SNAPSHOT_PROPERTIES)[number];
export type StyleValues = Record<SnapshotProperty, string>;
export type ElementNamespace = 'html' | 'svg' | 'other';

export interface Size {
  width: number;
  height: number;
}

/**
 * CSS initial values as Chrome reports them. Used when the real browser
 * defaults for an element aren't known. Transform origin is handled separately,
 * because its default depends on the element's size.
 */
export const INITIAL_STYLE_VALUES: StyleValues = {
  display: 'inline',
  position: 'static',
  'overflow-x': 'visible',
  'overflow-y': 'visible',
  'z-index': 'auto',
  transform: 'none',
  translate: 'none',
  rotate: 'none',
  scale: 'none',
  'transform-origin': '',
  perspective: 'none',
  opacity: '1',
  filter: 'none',
  'clip-path': 'none',
  'border-top-left-radius': '0px',
  'border-top-right-radius': '0px',
  'border-bottom-right-radius': '0px',
  'border-bottom-left-radius': '0px',
  'transition-property': 'all',
  'transition-duration': '0s',
  'transition-timing-function': 'ease',
  'transition-delay': '0s',
  'animation-name': 'none',
  'animation-duration': '0s',
  'animation-timing-function': 'ease',
  'animation-delay': '0s',
  'animation-iteration-count': '1',
  'animation-direction': 'normal',
  'animation-fill-mode': 'none',
  'animation-play-state': 'running',
  'animation-timeline': 'auto',
};

/** What the inspector observed about the selected element, read once when it was selected. */
export interface ElementSnapshot {
  /** Name and on-screen size (including any transforms). */
  element: ElementSummary;
  namespace: ElementNamespace;
  /** Size of the element's box before transforms. Null for SVG elements inside an <svg>. */
  layoutSize: Size | null;
  /** Top-left corner of the on-screen box, in page coordinates. */
  position: { x: number; y: number };
  /** Ancestors from the top of the page down to the parent. The closest ones are kept. */
  path: ElementName[];
  styles: StyleValues;
  /** Attributes that change the browser's defaults, so the panel compares against the right ones. */
  defaultsKey: { type: string | null; open: boolean };
  /** The pointer was over the element when it was read, so any hover styles are included. */
  hovered: boolean;
  canSelectParent: boolean;
  canSelectChild: boolean;
}

export interface RawSnapshot {
  tag: string;
  id: string;
  classes: readonly string[];
  namespace: ElementNamespace;
  rect: { left: number; top: number; width: number; height: number };
  scroll: { x: number; y: number };
  layoutSize: Size | null;
  path: ReadonlyArray<{ tag: string; id: string; classes: readonly string[] }>;
  styles: Readonly<Record<string, string>>;
  type: string | null;
  open: boolean;
  hovered: boolean;
  canSelectParent: boolean;
  canSelectChild: boolean;
}

const MAX_PATH_LENGTH = 30;
/** Style values come from the page; some, like clip-path paths, can be very long. */
const MAX_VALUE_LENGTH = 300;
const MAX_TYPE_LENGTH = 40;

/** Builds a snapshot from raw page values, capping everything that came from the page. */
export function createElementSnapshot(raw: RawSnapshot): ElementSnapshot {
  const styles = { ...INITIAL_STYLE_VALUES };
  for (const property of SNAPSHOT_PROPERTIES) {
    styles[property] = truncate(raw.styles[property] ?? '', MAX_VALUE_LENGTH);
  }

  return {
    element: createElementSummary({
      tag: raw.tag,
      id: raw.id,
      classes: raw.classes,
      width: raw.rect.width,
      height: raw.rect.height,
    }),
    namespace: raw.namespace,
    layoutSize: raw.layoutSize && {
      width: Math.round(raw.layoutSize.width),
      height: Math.round(raw.layoutSize.height),
    },
    position: { x: Math.round(raw.rect.left + raw.scroll.x), y: Math.round(raw.rect.top + raw.scroll.y) },
    path: raw.path.slice(-MAX_PATH_LENGTH).map((ancestor) => createElementName(ancestor)),
    styles,
    defaultsKey: { type: raw.type ? raw.type.slice(0, MAX_TYPE_LENGTH).toLowerCase() : null, open: raw.open },
    hovered: raw.hovered,
    canSelectParent: raw.canSelectParent,
    canSelectChild: raw.canSelectChild,
  };
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
