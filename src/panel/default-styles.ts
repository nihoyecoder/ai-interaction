import { SNAPSHOT_PROPERTIES, type ElementSnapshot, type StyleValues } from '@/core/element-snapshot';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const cache = new Map<string, Partial<StyleValues>>();

/**
 * Chrome's built-in default styles for an element like the selected one, so
 * the details card can leave them out. They're read from an unstyled copy made
 * here in the side panel, never on the web page. A closed shadow root keeps the
 * panel's own CSS away from the copy, so only Chrome's defaults apply.
 */
export function readDefaultStyles(snapshot: ElementSnapshot): Partial<StyleValues> {
  const { namespace, element, defaultsKey } = snapshot;
  const key = [namespace, element.tag, defaultsKey.type ?? '', defaultsKey.open].join('|');
  let defaults = cache.get(key);
  if (!defaults) {
    defaults = probeDefaults(snapshot);
    cache.set(key, defaults);
  }
  return defaults;
}

function probeDefaults({ namespace, element, defaultsKey }: ElementSnapshot): Partial<StyleValues> {
  if (namespace === 'other') return {};

  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
  const root = host.attachShadow({ mode: 'closed' });
  try {
    let probe: Element;
    if (namespace === 'svg' && element.tag !== 'svg') {
      // SVG elements get their defaults inside an <svg>.
      const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
      probe = document.createElementNS(SVG_NAMESPACE, element.tag);
      svg.append(probe);
      root.append(svg);
    } else {
      probe = namespace === 'svg' ? document.createElementNS(SVG_NAMESPACE, 'svg') : document.createElement(element.tag);
      root.append(probe);
    }
    if (defaultsKey.type) probe.setAttribute('type', defaultsKey.type);
    if (defaultsKey.open) probe.setAttribute('open', '');

    document.body.append(host);
    const computed = getComputedStyle(probe);
    const defaults: Partial<StyleValues> = {};
    for (const property of SNAPSHOT_PROPERTIES) defaults[property] = computed.getPropertyValue(property);
    return defaults;
  } catch {
    // For example, a tag name this document can't create. Fall back to CSS initial values.
    return {};
  } finally {
    host.remove();
  }
}
