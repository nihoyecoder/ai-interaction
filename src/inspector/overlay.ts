import { formatElementName, formatElementSize, type ElementSummary } from '@/core/element-summary';
import { createTopLayer, layerElement } from './layer';

/** Space between the label and the element or the viewport edge, in px. */
const GAP = 4;

const STYLES = `
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
`;

export interface HighlightOverlay {
  show(rect: DOMRect, summary: ElementSummary): void;
  hide(): void;
  destroy(): void;
}

/** The on-page highlight: a box around an element plus a small label, drawn in our own top layer. */
export function createHighlightOverlay(): HighlightOverlay {
  const layer = createTopLayer(STYLES);
  const box = layerElement('div', 'box');
  const label = layerElement('div', 'label');
  const name = layerElement('span', 'name');
  const size = layerElement('span', 'size');
  label.append(name, size);
  box.hidden = true;
  label.hidden = true;
  layer.root.append(box, label);

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
    destroy: layer.destroy,
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
