// Bundled into the test page by scripts/sections/check-sections.mjs. It runs the extension's real
// Select Design code on the page, without the side panel, so its choices can be checked in Chrome.
import { formatElementName } from '@/core/element-summary';
import { pageOutline } from '@/core/sections';
import type { PickMode } from '@/core/selection';
import { elementAt, summarizeElement } from '@/inspector/dom';
import { readPageTree } from '@/inspector/section-input';
import { targetAt } from '@/inspector/targets';

const nameOf = (element: Element) => formatElementName(summarizeElement(element));

const harness = {
  /**
   * What the picker highlights at a viewport point, after `steps` presses of ↑ (positive) or ↓
   * (negative), and whether it matches the `expected` selector.
   */
  pick(x: number, y: number, mode: PickMode, steps: number, expected: string) {
    const hovered = elementAt(x, y);
    if (!hovered) return { ok: false, got: '(nothing at this point)', levels: [] as string[], ms: 0 };
    const started = performance.now();
    const target = targetAt(hovered, x, y, mode);
    const ms = performance.now() - started;
    if (!target) return { ok: false, got: '(no highlight)', levels: [] as string[], ms };
    const index = Math.max(0, Math.min(target.index + steps, target.levels.length - 1));
    const element = target.levels[index]!.element;
    return {
      ok: element.matches(expected),
      got: nameOf(element),
      levels: target.levels.map((level, at) => (at === index ? `[${nameOf(level.element)}]` : nameOf(level.element))),
      ms,
    };
  },

  /** Full page's sections, and whether they match the `expected` selectors in order. */
  outline(expected: string[]) {
    const started = performance.now();
    const { body, metrics, elementOf } = readPageTree();
    const sections = pageOutline(body, metrics).map((tree) => ({ element: elementOf(tree), placement: tree.node.placement }));
    const ms = performance.now() - started;
    const ok =
      sections.length === expected.length && sections.every((section, index) => section.element.matches(expected[index]!));
    const got = sections.map(({ element, placement }) => nameOf(element) + (placement === 'flow' ? '' : ` (${placement})`));
    return { ok, got, ms };
  },
};

(window as unknown as { __aiSections: typeof harness }).__aiSections = harness;
