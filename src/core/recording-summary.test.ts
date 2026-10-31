import { describe, expect, it } from 'vitest';
import { createEmptyRecording, type ElementSample, type Recording, type ScrollSample } from './recording';
import { summarizeRecording } from './recording-summary';

const name = { tag: 'div', id: null, classes: [] };

function sample(t: number, overrides: Partial<ElementSample> = {}): ElementSample {
  return { t, element: 0, x: 100, y: 300, width: 200, height: 100, transform: 'none', opacity: 1, ...overrides };
}

function recording(overrides: Partial<Recording>): Recording {
  return {
    ...createEmptyRecording('user'),
    durationMs: 3000,
    frameCount: 180,
    elements: [{ name, depth: 0 }],
    scroll: [{ t: 0, area: -1, x: 0, y: 0 }],
    ...overrides,
  };
}

/** Page scrolled down by `y` px at time `t`. */
const pageScroll = (t: number, y: number): ScrollSample => ({ t, area: -1, x: 0, y });

describe('summarizeRecording', () => {
  it('reports no change for an element that stayed still', () => {
    expect(summarizeRecording(recording({ samples: [sample(0)] })).elementChange).toBeNull();
  });

  it('ignores movement caused by scrolling the page', () => {
    const summary = summarizeRecording(
      recording({
        samples: [sample(0), sample(500, { y: 200 }), sample(1000, { y: 100 })],
        scroll: [pageScroll(0, 0), pageScroll(500, 100), pageScroll(1000, 200)],
      }),
    );
    expect(summary.elementChange).toBeNull();
    expect(summary.pageScrollPx).toBe(200);
  });

  it('ignores fixed elements that stay put while the page scrolls', () => {
    const summary = summarizeRecording(
      recording({ samples: [sample(0)], scroll: [pageScroll(0, 0), pageScroll(500, 300)] }),
    );
    expect(summary.elementChange).toBeNull();
  });

  it('reports when the transform or opacity changed', () => {
    const summary = summarizeRecording(
      recording({
        samples: [
          sample(0),
          sample(1200, { transform: 'matrix(1, 0, 0, 1, 0, -2)' }),
          sample(1500, { transform: 'matrix(1, 0, 0, 1, 0, -8)' }),
          sample(1800, { opacity: 0.5 }),
        ],
      }),
    );
    expect(summary.elementChange).toEqual({ from: 1200, to: 1800 });
  });

  it('counts movement that differs from the scroll, such as parallax', () => {
    const summary = summarizeRecording(
      recording({
        samples: [sample(0), sample(500, { y: 250 })],
        scroll: [pageScroll(0, 0), pageScroll(500, 100)],
      }),
    );
    expect(summary.elementChange).toEqual({ from: 500, to: 500 });
  });

  it('counts the inner elements that changed', () => {
    const summary = summarizeRecording(
      recording({
        elements: [
          { name, depth: 0 },
          { name, depth: 1 },
          { name, depth: 1 },
        ],
        samples: [
          sample(0),
          sample(0, { element: 1 }),
          sample(0, { element: 2 }),
          sample(400, { element: 2, opacity: 0.4 }),
        ],
      }),
    );
    expect(summary.changedDescendants).toBe(1);
    expect(summary.trackedDescendants).toBe(2);
    expect(summary.elementChange).toBeNull();
  });

  it('counts clicks, hovers, and scrolled areas', () => {
    const summary = summarizeRecording(
      recording({
        presses: [
          { t: 100, type: 'press', x: 0, y: 0, onElement: true },
          { t: 180, type: 'release', x: 0, y: 0, onElement: true },
        ],
        hover: [
          { t: 50, hovered: true },
          { t: 900, hovered: false },
          { t: 1200, hovered: true },
        ],
        scroll: [pageScroll(0, 0), { t: 300, area: 0, x: 0, y: 120 }, { t: 400, area: 0, x: 0, y: 240 }],
      }),
    );
    expect(summary.clicks).toBe(1);
    expect(summary.hoverEnters).toBe(2);
    expect(summary.scrolledAreas).toBe(1);
  });
});
