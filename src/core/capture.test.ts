import { describe, expect, it } from 'vitest';
import { captureFileName, createCapture } from './capture';
import { createElementSnapshot, INITIAL_STYLE_VALUES } from './element-snapshot';
import { createEmptyRecording } from './recording';

const snapshot = createElementSnapshot({
  tag: 'div',
  id: '',
  classes: ['card'],
  namespace: 'html',
  rect: { left: 0, top: 0, width: 320, height: 480 },
  scroll: { x: 0, y: 0 },
  layoutSize: { width: 320, height: 480 },
  path: [],
  styles: INITIAL_STYLE_VALUES,
  type: null,
  open: false,
  hovered: false,
  canSelectParent: true,
  canSelectChild: false,
});

const card = { tag: 'div', id: null, classes: ['card'] };

describe('createCapture', () => {
  const recording = {
    ...createEmptyRecording('user'),
    durationMs: 2000,
    classChanges: [{ t: 400, element: 0, target: card, added: ['is-on'], removed: [] }],
    styleWrites: [{ element: 0, target: card, count: 40 }],
  };
  const capture = createCapture({
    hostname: 'dribbble.com',
    extensionVersion: '0.1.0',
    snapshot,
    recording,
    exportedAt: new Date('2026-10-31T19:05:12Z'),
  });

  it('is versioned and keeps only the hostname of the page', () => {
    expect(capture).toMatchObject({
      format: 'ai-interaction/capture',
      version: 1,
      page: { hostname: 'dribbble.com' },
      exportedAt: '2026-10-31T19:05:12.000Z',
    });
  });

  it('puts browser-reported evidence under observed and measurements under measured', () => {
    expect(capture.observed.classChanges).toHaveLength(1);
    expect(capture.observed.styleWrites).toHaveLength(1);
    expect(capture.measured?.recording).not.toHaveProperty('classChanges');
    expect(capture.measured?.summary.durationMs).toBe(2000);
  });

  it('keeps only inferred lines under estimated', () => {
    expect(capture.estimated).toEqual([
      {
        text: 'Inline styles changed 40 times on 1 element, which usually means JavaScript is animating it.',
        label: 'Estimated',
      },
    ]);
  });

  it('works without a recording', () => {
    const elementOnly = createCapture({
      hostname: 'example.com',
      extensionVersion: '0.1.0',
      snapshot,
      recording: null,
      exportedAt: new Date('2026-10-31T19:05:12Z'),
    });
    expect(elementOnly.measured).toBeNull();
    expect(elementOnly.observed.animations).toEqual([]);
    expect(elementOnly.estimated).toEqual([]);
  });

  it('names the file after the site and the time', () => {
    expect(captureFileName(capture)).toBe('ai-interaction-dribbble.com-2026-10-31-1905.json');
  });
});
