import { formatElementName, formatElementSize, type ElementSummary } from '@/core/element-summary';

/** Space between the label and the element or the viewport edge, in px. */
const GAP = 4;

/** Inline `!important` styles on our host element, so page CSS can't move or hide it. */
const HOST_STYLE: Record<string, string> = {
  display: 'block',
  position: 'fixed',
  inset: '0',
  width: 'auto',
  height: 'auto',
  'max-width': 'none',
  'max-height': 'none',
  margin: '0',
  padding: '0',
  border: '0',
  background: 'transparent',
  overflow: 'hidden',
  'pointer-events': 'none',
  'z-index': '2147483647',
};

// `all: initial` stops inherited page styles (fonts, letter-spacing, etc.) from leaking in.
const STYLES = `
  .root {
    all: initial;
    position: fixed;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .box {
    position: absolute;
    top: 0;
    left: 0;
    box-sizing: border-box;
    border: 1px solid rgb(59 130 246);
    background: rgb(59 130 246 / 0.12);
  }
  .label {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    gap: 6px;
    max-width: calc(100% - ${GAP * 2}px);
    box-sizing: border-box;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgb(17 24 39);
    color: rgb(255 255 255);
    font: 500 11px/16px system-ui, sans-serif;
    white-space: nowrap;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .size {
    flex: none;
    color: rgb(209 213 219);
    font-variant-numeric: tabular-nums;
  }
  [hidden] {
    display: none !important;
  }
`;

export interface HighlightOverlay {
  show(rect: DOMRect, summary: ElementSummary): void;
  hide(): void;
  destroy(): void;
}

/**
 * The on-page highlight: a box around the hovered element plus a small label.
 * It never touches the page's own elements. It's a separate layer in a closed
 * shadow root (page CSS can't style it, page scripts can't reach into it),
 * with `pointer-events: none` so it never gets in the pointer's way.
 */
export function createHighlightOverlay(): HighlightOverlay {
  const host = document.createElement('ai-interaction-overlay');
  for (const [property, value] of Object.entries(HOST_STYLE)) {
    host.style.setProperty(property, value, 'important');
  }
  // A manual popover sits in the browser's top layer: above all page content, whatever its z-index or transforms.
  host.popover = 'manual';

  const style = document.createElement('style');
  style.textContent = STYLES;
  const root = createDiv('root');
  const box = createDiv('box');
  const label = createDiv('label');
  const name = document.createElement('span');
  name.className = 'name';
  const size = document.createElement('span');
  size.className = 'size';
  label.append(name, size);
  root.append(box, label);
  host.attachShadow({ mode: 'closed' }).append(style, root);

  box.hidden = true;
  label.hidden = true;
  document.documentElement.append(host);
  try {
    host.showPopover();
  } catch {
    // Without the top layer, the fixed position and maximum z-index still apply.
  }

  return {
    show(rect, summary) {
      box.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
      box.style.width = `${rect.width}px`;
      box.style.height = `${rect.height}px`;
      box.hidden = false;

      name.textContent = formatElementName(summary);
      size.textContent = formatElementSize(summary);
      label.hidden = false;
      placeLabel(label, rect);
    },
    hide() {
      box.hidden = true;
      label.hidden = true;
    },
    destroy() {
      host.remove();
    },
  };
}

/** Puts the label above the element, or below it, or inside it, always within the viewport. */
function placeLabel(label: HTMLElement, rect: DOMRect): void {
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const { offsetWidth: width, offsetHeight: height } = label;

  let top = rect.top - height - GAP;
  if (top < GAP) top = rect.bottom + GAP;
  if (top + height > viewportHeight - GAP) top = rect.top + GAP;
  top = clamp(top, GAP, viewportHeight - height - GAP);
  const left = clamp(rect.left, GAP, viewportWidth - width - GAP);

  label.style.transform = `translate(${left}px, ${top}px)`;
}

function createDiv(className: string): HTMLDivElement {
  const div = document.createElement('div');
  div.className = className;
  return div;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
