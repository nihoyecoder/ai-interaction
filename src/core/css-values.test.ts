import { describe, expect, it } from 'vitest';
import { formatNumber, formatTime, parseTimeMs, splitCssList } from './css-values';

describe('splitCssList', () => {
  it('splits on top-level commas only', () => {
    expect(splitCssList('opacity, cubic-bezier(0.2, 0, 0, 1), steps(4, end)')).toEqual([
      'opacity',
      'cubic-bezier(0.2, 0, 0, 1)',
      'steps(4, end)',
    ]);
  });

  it('returns an empty list for an empty value', () => {
    expect(splitCssList('')).toEqual([]);
  });
});

describe('parseTimeMs', () => {
  it.each([
    ['0.3s', 300],
    ['300ms', 300],
    ['1.5s', 1500],
    ['0s', 0],
    ['-0.2s', -200],
    ['.5s', 500],
  ] as const)('%s is %d ms', (value, ms) => {
    expect(parseTimeMs(value)).toBeCloseTo(ms);
  });

  it('returns null for values that are not times', () => {
    expect(parseTimeMs('auto')).toBeNull();
    expect(parseTimeMs('')).toBeNull();
  });
});

describe('formatTime', () => {
  it('uses ms below one second and s from one second up', () => {
    expect(formatTime('0.3s')).toBe('300 ms');
    expect(formatTime('1.25s')).toBe('1.25 s');
    expect(formatTime('2s')).toBe('2 s');
  });

  it('keeps values that are not times', () => {
    expect(formatTime('auto')).toBe('auto');
  });
});

describe('formatNumber', () => {
  it('rounds and drops trailing zeros', () => {
    expect(formatNumber(0.8200001, 3)).toBe('0.82');
    expect(formatNumber(-0.0001, 2)).toBe('0');
  });
});
