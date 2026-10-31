/**
 * A short, safe description of a page element, used for the labels in the
 * on-page highlight and the side panel. Ids and class names come from the
 * page, so they're untrusted text: they're capped and only ever shown as text.
 */
export interface ElementSummary {
  /** Tag name as the page wrote it, e.g. `div` or `linearGradient`. */
  tag: string;
  id: string | null;
  classes: string[];
  /** Rendered size in CSS pixels, rounded. */
  width: number;
  height: number;
}

const MAX_NAME_LENGTH = 40;
const MAX_CLASSES = 10;
/** How many classes a label shows before "…". */
const LABEL_CLASSES = 2;

export function createElementSummary(raw: {
  tag: string;
  id: string;
  classes: readonly string[];
  width: number;
  height: number;
}): ElementSummary {
  return {
    tag: truncate(raw.tag),
    id: raw.id ? truncate(raw.id) : null,
    classes: raw.classes.slice(0, MAX_CLASSES).map((name) => truncate(name)),
    width: Math.round(raw.width),
    height: Math.round(raw.height),
  };
}

/** A DevTools-style name such as `div#hero.card.is-active…`. */
export function formatElementName({ tag, id, classes }: ElementSummary): string {
  const idPart = id ? `#${id}` : '';
  const classPart = classes
    .slice(0, LABEL_CLASSES)
    .map((name) => `.${name}`)
    .join('');
  const more = classes.length > LABEL_CLASSES ? '…' : '';
  return `${tag}${idPart}${classPart}${more}`;
}

export function formatElementSize({ width, height }: ElementSummary): string {
  return `${width} × ${height}`;
}

function truncate(text: string): string {
  return text.length > MAX_NAME_LENGTH ? `${text.slice(0, MAX_NAME_LENGTH - 1)}…` : text;
}
