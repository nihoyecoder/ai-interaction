import { describe, expect, it } from 'vitest';
import { createElementSelection, createPageSelection, MAX_PAGE_SECTIONS } from './selection';

describe('createElementSelection', () => {
  it('rounds sizes and turns the viewport box into page coordinates', () => {
    const selection = createElementSelection({
      scope: 'section',
      tag: 'section',
      id: 'pricing',
      classes: ['band', 'dark'],
      rect: { left: 0.4, top: -120.6, width: 1279.6, height: 640.2 },
      scroll: { x: 0, y: 2400 },
      path: [
        { tag: 'body', id: '', classes: [] },
        { tag: 'main', id: '', classes: [] },
      ],
      canWiden: true,
      canNarrow: true,
      viewport: { width: 1024.4, height: 900 },
    });

    expect(selection).toEqual({
      scope: 'section',
      element: { tag: 'section', id: 'pricing', classes: ['band', 'dark'], width: 1280, height: 640 },
      path: [
        { tag: 'body', id: null, classes: [] },
        { tag: 'main', id: null, classes: [] },
      ],
      position: { x: 0, y: 2279 },
      canWiden: true,
      canNarrow: true,
      viewport: { width: 1024, height: 900 },
    });
  });

  it('keeps only the closest ancestors of very deep elements', () => {
    const path = Array.from({ length: 40 }, (_, index) => ({ tag: 'div', id: `level-${index}`, classes: [] }));
    const selection = createElementSelection({
      scope: 'element',
      tag: 'span',
      id: '',
      classes: [],
      rect: { left: 0, top: 0, width: 10, height: 10 },
      scroll: { x: 0, y: 0 },
      path,
      canWiden: true,
      canNarrow: false,
      viewport: { width: 800, height: 600 },
    });

    expect(selection.path).toHaveLength(30);
    expect(selection.path[0]?.id).toBe('level-10');
    expect(selection.path.at(-1)?.id).toBe('level-39');
  });
});

describe('createPageSelection', () => {
  it('names each section and keeps the page and viewport sizes', () => {
    const selection = createPageSelection({
      page: { width: 1024, height: 6400.5 },
      viewport: { width: 1024, height: 900 },
      sections: [
        { tag: 'header', id: '', classes: ['site-header'], width: 1024, height: 64, placement: 'sticky' },
        { tag: 'section', id: 'hero', classes: [], width: 1024, height: 720.4, placement: 'flow' },
      ],
    });

    expect(selection).toEqual({
      scope: 'page',
      page: { width: 1024, height: 6401 },
      viewport: { width: 1024, height: 900 },
      sections: [
        { element: { tag: 'header', id: null, classes: ['site-header'], width: 1024, height: 64 }, placement: 'sticky' },
        { element: { tag: 'section', id: 'hero', classes: [], width: 1024, height: 720 }, placement: 'flow' },
      ],
    });
  });

  it('keeps a capped number of sections', () => {
    const sections = Array.from({ length: 60 }, (_, index) => ({
      tag: 'div',
      id: '',
      classes: [],
      width: 1000,
      height: 100 + index,
      placement: 'flow' as const,
    }));
    const selection = createPageSelection({ page: { width: 1000, height: 6000 }, viewport: { width: 1000, height: 800 }, sections });

    expect(selection.sections).toHaveLength(MAX_PAGE_SECTIONS);
  });
});
