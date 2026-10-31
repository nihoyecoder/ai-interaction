import { describe, expect, it } from 'vitest';
import { createAnimationRecord } from '../recording';
import { describeCause, describeChange, formatDuration, formatPropertyChange } from './describe';
import type { Cause } from './types';

const transition = createAnimationRecord({
  t: 0,
  runningAtStart: false,
  element: 0,
  target: { tag: 'div', id: null, classes: [] },
  kind: 'css-transition',
  name: 'transform',
  pseudo: null,
  duration: 200,
  delay: 0,
  easing: 'ease',
  iterations: 1,
  direction: 'normal',
  fill: 'backwards',
  scrollDriven: false,
  keyframes: [],
});

function cause(overrides: Partial<Cause>): Cause {
  return {
    trigger: 'click',
    triggerAt: 0,
    classChange: null,
    mechanism: 'css-transition',
    animation: transition,
    confidence: 'high',
    ...overrides,
  };
}

describe('describeCause', () => {
  it('describes a click that adds a class', () => {
    expect(describeCause(cause({ classChange: { added: ['is-on'], removed: [], at: 0 } }))).toBe(
      'On click, the page adds class "is-on", which starts a CSS transition ("transform").',
    );
  });

  it('describes a CSS :hover transition', () => {
    expect(describeCause(cause({ trigger: 'hover-start' }))).toBe(
      'When the pointer enters, the browser\'s :hover state starts a CSS transition ("transform").',
    );
  });

  it('describes JavaScript animation', () => {
    expect(describeCause(cause({ mechanism: 'javascript', animation: null }))).toBe(
      'On click, JavaScript animates it by changing its inline style.',
    );
  });

  it('describes motion with no user action', () => {
    expect(describeCause(cause({ trigger: 'none', mechanism: 'unknown', animation: null }))).toBe(
      "Without any action, it changes in a way that wasn't reported.",
    );
  });
});

describe('describeChange', () => {
  it('describes a motion that returns by how far it went', () => {
    expect(describeChange({ property: 'translateY', from: 0, to: 0, min: -12, max: 0 })).toBe('moves up 12 px and back');
  });

  it('describes fades', () => {
    expect(describeChange({ property: 'opacity', from: 1, to: 0, min: 0, max: 1 })).toBe('fades out (opacity 1 → 0)');
  });
});

describe('formatPropertyChange', () => {
  it('mentions overshoot and jumps', () => {
    expect(formatPropertyChange({ property: 'scale', from: 0.8, to: 1, min: 0.8, max: 1.06, jumpedFrom: 1 })).toBe(
      'scale 0.8 → 1 (reaches 0.8 to 1.06 on the way), jumps there from 1 first',
    );
  });
});

describe('formatDuration', () => {
  it('rounds measured times and keeps observed ones exact', () => {
    expect(formatDuration(287, 'measured')).toBe('about 290 ms');
    expect(formatDuration(300, 'observed')).toBe('300 ms');
    expect(formatDuration(1017, 'measured')).toBe('about 1 s');
    expect(formatDuration(999, 'measured')).toBe('about 1 s');
  });
});
