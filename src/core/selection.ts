import type { Size } from './element-snapshot';
import { createElementName, createElementSummary, type ElementName, type ElementSummary } from './element-summary';

/** How the user picks on the page. Full page needs no picking. */
export type PickMode = 'element' | 'section';

/** What the user selected for Select Design. Everything in it was read from the page (Observed). */
export type DesignSelection = ElementSelection | PageSelection;

export interface ElementSelection {
  scope: PickMode;
  /** Name and on-screen size. */
  element: ElementSummary;
  /** Ancestors from the top of the page down to the parent. The closest ones are kept. */
  path: ElementName[];
  /** Top-left corner of the on-screen box, in page coordinates. */
  position: { x: number; y: number };
  canWiden: boolean;
  canNarrow: boolean;
  /** The visible part of the page when it was selected. The side panel makes it narrower. */
  viewport: Size;
}

export interface PageSelection {
  scope: 'page';
  /** The whole page, including what's scrolled out of view. */
  page: Size;
  viewport: Size;
  /** The page's main blocks, in the order the page's code lists them, which is almost always top to bottom. */
  sections: PageSection[];
}

export interface PageSection {
  element: ElementSummary;
  /** Sticky and fixed sections stay on screen while the page scrolls, such as a header. */
  placement: 'flow' | 'sticky' | 'fixed';
}

interface RawName {
  tag: string;
  id: string;
  classes: readonly string[];
}

export interface RawElementSelection extends RawName {
  scope: PickMode;
  /** The element's on-screen box, relative to the viewport. */
  rect: { left: number; top: number; width: number; height: number };
  scroll: { x: number; y: number };
  path: readonly RawName[];
  canWiden: boolean;
  canNarrow: boolean;
  viewport: Size;
}

export interface RawPageSelection {
  page: Size;
  viewport: Size;
  sections: ReadonlyArray<RawName & { width: number; height: number; placement: PageSection['placement'] }>;
}

const MAX_PATH_LENGTH = 30;
export const MAX_PAGE_SECTIONS = 40;

/** Builds an element or section selection from raw page values, capping everything that came from the page. */
export function createElementSelection(raw: RawElementSelection): ElementSelection {
  return {
    scope: raw.scope,
    element: createElementSummary({ ...raw, width: raw.rect.width, height: raw.rect.height }),
    path: raw.path.slice(-MAX_PATH_LENGTH).map((ancestor) => createElementName(ancestor)),
    position: { x: Math.round(raw.rect.left + raw.scroll.x), y: Math.round(raw.rect.top + raw.scroll.y) },
    canWiden: raw.canWiden,
    canNarrow: raw.canNarrow,
    viewport: roundSize(raw.viewport),
  };
}

/** Builds a full-page selection from raw page values, keeping at most MAX_PAGE_SECTIONS sections. */
export function createPageSelection(raw: RawPageSelection): PageSelection {
  return {
    scope: 'page',
    page: roundSize(raw.page),
    viewport: roundSize(raw.viewport),
    sections: raw.sections.slice(0, MAX_PAGE_SECTIONS).map((section) => ({
      element: createElementSummary(section),
      placement: section.placement,
    })),
  };
}

function roundSize({ width, height }: Size): Size {
  return { width: Math.round(width), height: Math.round(height) };
}
