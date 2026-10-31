/**
 * Short, safe descriptions of page elements, used for labels in the on-page
 * highlight and the side panel. Ids and class names come from the page, so
 * they're untrusted text: they're capped and only ever shown as text.
 */
export interface ElementName {
  /** Tag name as the page wrote it, e.g. `div` or `linearGradient`. */
  tag: string;
  id: string | null;
  classes: string[];
}

export interface ElementSummary extends ElementName {
  /** Rendered size in CSS pixels, rounded. */
  width: number;
  height: number;
}

const MAX_NAME_LENGTH = 40;
const MAX_CLASSES = 10;
/** How many classes a label shows before "…". */
const LABEL_CLASSES = 2;

export function createElementName(raw: { tag: string; id: string; classes: readonly string[] }): ElementName {
  return {
    tag: truncate(raw.tag),
    id: raw.id ? truncate(raw.id) : null,
    classes: raw.classes.slice(0, MAX_CLASSES).map((name) => truncate(name)),
  };
}

export function createElementSummary(raw: {
  tag: string;
  id: string;
  classes: readonly string[];
  width: number;
  height: number;
}): ElementSummary {
  return { ...createElementName(raw), width: Math.round(raw.width), height: Math.round(raw.height) };
}

/** A DevTools-style name such as `div#hero.card.is-active…`. */
export function formatElementName({ tag, id, classes }: ElementName): string {
  const idPart = id ? `#${id}` : '';
  const classPart = classes
    .slice(0, LABEL_CLASSES)
    .map((name) => `.${name}`)
    .join('');
  const more = classes.length > LABEL_CLASSES ? '…' : '';
  return `${tag}${idPart}${classPart}${more}`;
}

export function formatElementSize({ width, height }: { width: number; height: number }): string {
  return `${width} × ${height}`;
}

/** The last few ancestors, e.g. "… › section.hero › div.grid". */
export function formatElementPath(path: readonly ElementName[], visible = 3): string {
  const shown = path.slice(-visible).map((name) => formatElementName(name));
  return (path.length > visible ? ['…', ...shown] : shown).join(' › ');
}

function truncate(text: string): string {
  return text.length > MAX_NAME_LENGTH ? `${text.slice(0, MAX_NAME_LENGTH - 1)}…` : text;
}
