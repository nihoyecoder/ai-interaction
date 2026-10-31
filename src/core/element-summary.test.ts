import { describe, expect, it } from 'vitest';
import { createElementSummary, formatElementName, formatElementSize, type ElementSummary } from './element-summary';

function summary(overrides: Partial<ElementSummary> = {}): ElementSummary {
  return { tag: 'div', id: null, classes: [], width: 320, height: 480, ...overrides };
}

describe('createElementSummary', () => {
  it('rounds the size and drops an empty id', () => {
    expect(createElementSummary({ tag: 'div', id: '', classes: ['card'], width: 320.4, height: 479.6 })).toEqual({
      tag: 'div',
      id: null,
      classes: ['card'],
      width: 320,
      height: 480,
    });
  });

  it('caps long ids and class names at 40 characters', () => {
    const long = 'x'.repeat(100);
    const result = createElementSummary({ tag: 'div', id: long, classes: [long], width: 0, height: 0 });
    expect(result.id).toHaveLength(40);
    expect(result.id?.endsWith('…')).toBe(true);
    expect(result.classes[0]).toHaveLength(40);
  });

  it('keeps at most 10 classes', () => {
    const classes = Array.from({ length: 30 }, (_, index) => `c${index}`);
    expect(createElementSummary({ tag: 'div', id: '', classes, width: 0, height: 0 }).classes).toHaveLength(10);
  });

  it('keeps SVG tag names as written', () => {
    expect(createElementSummary({ tag: 'linearGradient', id: '', classes: [], width: 0, height: 0 }).tag).toBe(
      'linearGradient',
    );
  });
});

describe('formatElementName', () => {
  it('formats tag, id, and classes like DevTools', () => {
    expect(formatElementName(summary({ id: 'hero', classes: ['card'] }))).toBe('div#hero.card');
  });

  it('shows two classes, then an ellipsis', () => {
    expect(formatElementName(summary({ classes: ['a', 'b', 'c'] }))).toBe('div.a.b…');
  });

  it('shows just the tag when there is no id or class', () => {
    expect(formatElementName(summary({ tag: 'section' }))).toBe('section');
  });
});

describe('formatElementSize', () => {
  it('formats width × height', () => {
    expect(formatElementSize(summary())).toBe('320 × 480');
  });
});
