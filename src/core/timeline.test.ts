import { describe, expect, it } from 'vitest';
import { createAnimationRecord, createEmptyRecording, type ElementSample, type Recording } from './recording';
import { buildTimeline, groupIntoSpans } from './timeline';

const name = { tag: 'div', id: null, classes: ['card'] };
const item = { tag: 'li', id: null, classes: [] };

function sample(t: number, overrides: Partial<ElementSample> = {}): ElementSample {
  return { t, element: 0, x: 0, y: 0, width: 100, height: 100, transform: 'none', opacity: 1, ...overrides };
}

function recording(overrides: Partial<Recording>): Recording {
  return {
    ...createEmptyRecording('user'),
    durationMs: 4000,
    elements: [{ name, depth: 0 }],
    scroll: [{ t: 0, area: -1, x: 0, y: 0 }],
    ...overrides,
  };
}

function animation(overrides: Partial<Parameters<typeof createAnimationRecord>[0]> = {}) {
  return createAnimationRecord({
    t: 1000,
    runningAtStart: false,
    element: 0,
    target: name,
    kind: 'css-animation',
    name: 'pop',
    pseudo: null,
    duration: 500,
    delay: 0,
    easing: 'ease-out',
    iterations: 1,
    direction: 'normal',
    fill: 'both',
    scrollDriven: false,
    keyframes: [],
    ...overrides,
  });
}

describe('groupIntoSpans', () => {
  it('joins times that are close together', () => {
    expect(groupIntoSpans([100, 150, 200, 800, 820], 100)).toEqual([
      { start: 100, end: 200 },
      { start: 800, end: 820 },
    ]);
  });
});

describe('buildTimeline', () => {
  it('has no rows when nothing happened', () => {
    expect(buildTimeline(recording({ samples: [sample(0)] })).rows).toEqual([]);
  });

  it('shows hover spans, including one still open at the end', () => {
    const { rows } = buildTimeline(
      recording({
        hover: [
          { t: 500, hovered: true },
          { t: 1500, hovered: false },
          { t: 3000, hovered: true },
        ],
      }),
    );
    expect(rows[0]?.marks.map(({ start, end }) => ({ start, end }))).toEqual([
      { start: 500, end: 1500 },
      { start: 3000, end: 4000 },
    ]);
    expect(rows[0]?.marks[0]?.description).toBe('Pointer on the element from 0.5 to 1.5 s');
  });

  it('shows presses as points and ignores the starting scroll position', () => {
    const { rows } = buildTimeline(
      recording({
        presses: [
          { t: 1200, type: 'press', x: 0, y: 0, onElement: true },
          { t: 1280, type: 'release', x: 0, y: 0, onElement: true },
        ],
      }),
    );
    expect(rows.map((row) => row.id)).toEqual(['clicks']);
    expect(rows[0]?.marks).toEqual([
      { shape: 'point', start: 1200, end: 1200, description: 'Pressed on the element at 1.2 s' },
    ]);
  });

  it('groups changes of the element and of inner elements into spans', () => {
    const { rows } = buildTimeline(
      recording({
        elements: [
          { name, depth: 0 },
          { name: item, depth: 1 },
        ],
        samples: [
          sample(0),
          sample(0, { element: 1 }),
          sample(1000, { opacity: 0.9 }),
          sample(1016, { opacity: 0.8 }),
          sample(1033, { opacity: 0.7 }),
          sample(2000, { element: 1, opacity: 0.5 }),
        ],
      }),
    );
    expect(rows.map((row) => [row.id, row.label])).toEqual([
      ['element', 'Element'],
      ['inner-1', 'li'],
    ]);
    expect(rows[0]?.marks[0]).toMatchObject({ shape: 'span', start: 1000, end: 1033 });
  });

  it('draws an animation with its delay and duration', () => {
    const { rows } = buildTimeline(recording({ animations: [animation({ delay: 200, element: 1, target: item })] }));
    expect(rows[0]).toMatchObject({ label: 'pop · li', group: 'evidence' });
    expect(rows[0]?.marks[0]).toMatchObject({ shape: 'span', start: 1000, activeFrom: 1200, end: 1700 });
  });

  it('draws scroll-driven or already-running animations as ongoing', () => {
    const { rows } = buildTimeline(
      recording({ animations: [animation({ t: 0, runningAtStart: true, scrollDriven: true, duration: 'auto' })] }),
    );
    expect(rows[0]?.marks[0]).toMatchObject({ shape: 'ongoing', start: 0, end: 4000 });
  });

  it('keeps the timeline short and reports what was left out', () => {
    const timeline = buildTimeline(recording({ animations: Array.from({ length: 9 }, () => animation()) }));
    expect(timeline.rows).toHaveLength(6);
    expect(timeline.hiddenAnimationRows).toBe(3);
  });
});
