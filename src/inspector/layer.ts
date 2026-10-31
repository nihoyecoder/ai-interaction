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
const BASE_STYLES = `
  .root {
    all: initial;
    position: fixed;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  [hidden] {
    display: none !important;
  }
`;

export interface TopLayer {
  /** Container for our elements. Covers the viewport and never receives the pointer. */
  root: HTMLDivElement;
  destroy(): void;
}

/**
 * A layer above the page for our own UI, such as the highlight and the
 * recording pill. It never touches the page's own elements. It's a separate
 * element in the browser's top layer, so it sits above all page content
 * whatever its z-index or transforms. Its closed shadow root means page CSS
 * can't style it and page scripts can't reach into it. With
 * `pointer-events: none`, it never gets in the pointer's way.
 */
export function createTopLayer(styles: string): TopLayer {
  const host = document.createElement('ai-interaction-overlay');
  for (const [property, value] of Object.entries(HOST_STYLE)) {
    host.style.setProperty(property, value, 'important');
  }
  host.popover = 'manual';

  const style = document.createElement('style');
  style.textContent = BASE_STYLES + styles;
  const root = layerElement('div', 'root');
  host.attachShadow({ mode: 'closed' }).append(style, root);

  document.documentElement.append(host);
  try {
    host.showPopover();
  } catch {
    // Without the top layer, the fixed position and maximum z-index still apply.
  }
  return { root, destroy: () => host.remove() };
}

export function layerElement<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  return element;
}
