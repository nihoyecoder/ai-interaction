import { describe, expect, it } from 'vitest';
import { createAnimationRecord, createEmptyRecording, diffClasses, type Recording } from './recording';
import { describeEvidence, formatAnimationRecord } from './recording-evidence';

const card = { tag: 'div', id: null, classes: ['card'] };
const item = { tag: 'li', id: null, classes: [] };

function animation(overrides: Partial<Parameters<typeof createAnimationRecord>[0]> = {}) {
  return createAnimationRecord({
    t: 1200,
    runningAtStart: false,
    element: 0,
    target: card,
    kind: 'css-transition',
    name: 'transform',
    pseudo: null,
    duration: 300,
    delay: 0,
    easing: 'ease-out',
    iterations: 1,
    direction: 'normal',
    fill: 'backwards',
    scrollDriven: false,
    keyframes: [
      { offset: 0, easing: 'linear', composite: 'replace', transform: 'none' },
      { offset: 1, easing: 'linear', composite: 'replace', transform: 'matrix(1, 0, 0, 1, 0, -8)' },
    ],
    ...overrides,
  });
}

function recording(overrides: Partial<Recording>): Recording {
  return { ...createEmptyRecording('user'), ...overrides };
}

describe('createAnimationRecord', () => {
  it('keeps keyframe values and drops keyframe bookkeeping', () => {
    expect(animation().keyframes).toEqual([
      { offset: 0, easing: 'linear', values: { transform: 'none' } },
      { offset: 1, easing: 'linear', values: { transform: 'matrix(1, 0, 0, 1, 0, -8)' } },
    ]);
  });

  it('turns "auto" durations and infinite repeats into null', () => {
    const record = animation({ duration: 'auto', iterations: Number.POSITIVE_INFINITY });
    expect(record.durationMs).toBeNull();
    expect(record.iterations).toBeNull();
  });
});

describe('formatAnimationRecord', () => {
  it('formats a transition on the selected element', () => {
    expect(formatAnimationRecord(animation())).toBe('CSS transition: transform · 300 ms · ease-out · started at 1.2 s');
  });

  it("uses the keyframes' easing for CSS animations and names inner elements", () => {
    const record = animation({
      kind: 'css-animation',
      name: 'pop',
      element: 2,
      target: item,
      duration: 500,
      delay: 100,
      easing: 'linear',
      keyframes: [{ offset: 0, easing: 'ease-out', opacity: '0.25' }],
    });
    expect(formatAnimationRecord(record)).toBe('CSS animation: pop · 500 ms · ease-out · delay 100 ms · started at 1.2 s on li');
  });

  it('marks scroll-driven animations that were already running', () => {
    const record = animation({
      kind: 'css-animation',
      name: 'drift',
      duration: 'auto',
      easing: 'linear',
      keyframes: [],
      scrollDriven: true,
      runningAtStart: true,
      t: 0,
    });
    expect(formatAnimationRecord(record)).toBe('CSS animation: drift · auto · linear · scroll-driven · already running');
  });
});

describe('diffClasses', () => {
  it('finds added and removed class names', () => {
    expect(diffClasses('list', 'list is-playing')).toEqual({ added: ['is-playing'], removed: [] });
    expect(diffClasses('toggle is-on', 'toggle')).toEqual({ added: [], removed: ['is-on'] });
    expect(diffClasses('a b', 'b a')).toEqual({ added: [], removed: [] });
  });
});

describe('describeEvidence', () => {
  it('returns nothing when nothing happened', () => {
    expect(describeEvidence(recording({}))).toEqual([]);
  });

  it('lists class changes before animations', () => {
    const lines = describeEvidence(
      recording({
        classChanges: [{ t: 1200, element: 0, target: card, added: ['is-on'], removed: [] }],
        animations: [animation()],
      }),
    );
    expect(lines).toEqual([
      { text: 'Class "is-on" added at 1.2 s', label: 'Observed' },
      { text: 'CSS transition: transform · 300 ms · ease-out · started at 1.2 s', label: 'Observed' },
    ]);
  });

  it('groups repeated attribute changes', () => {
    const lines = describeEvidence(
      recording({
        attributeChanges: [
          { t: 500, element: 0, target: card, name: 'data-state' },
          { t: 900, element: 0, target: card, name: 'data-state' },
        ],
      }),
    );
    expect(lines).toEqual([{ text: 'Attribute "data-state" changed 2×, first at 0.5 s', label: 'Observed' }]);
  });

  it('estimates JavaScript animation from frequent inline-style changes', () => {
    expect(describeEvidence(recording({ styleWrites: [{ element: 0, target: card, count: 58 }] }))).toEqual([
      {
        text: 'Inline styles changed 58 times on 1 element, which usually means JavaScript is animating it.',
        label: 'Estimated',
      },
    ]);
    expect(describeEvidence(recording({ styleWrites: [{ element: 0, target: card, count: 2 }] }))).toEqual([
      { text: 'Inline styles changed 2× on 1 element', label: 'Observed' },
    ]);
  });

  it('summarizes long lists', () => {
    const animations = Array.from({ length: 8 }, () => animation());
    const lines = describeEvidence(recording({ animations }));
    expect(lines).toHaveLength(7);
    expect(lines.at(-1)?.text).toBe('…and 2 more animations');
  });
});
