import { describe, expect, it } from 'vitest';
import { INITIAL_STYLE_VALUES, type StyleValues } from './element-snapshot';
import { formatAnimation, formatTransition, readAnimations, readTransitions } from './motion';

function styles(overrides: Partial<StyleValues>): StyleValues {
  return { ...INITIAL_STYLE_VALUES, ...overrides };
}

describe('readTransitions', () => {
  it('treats the default "all 0s" as no transition', () => {
    expect(readTransitions(styles({}))).toEqual([]);
  });

  it('reads several transitions, repeating shorter lists', () => {
    const result = readTransitions(
      styles({
        'transition-property': 'transform, opacity',
        'transition-duration': '0.6s, 0.3s',
        'transition-timing-function': 'cubic-bezier(0.2, 0, 0, 1)',
        'transition-delay': '0s',
      }),
    );
    expect(result).toEqual([
      { property: 'transform', duration: '0.6s', easing: 'cubic-bezier(0.2, 0, 0, 1)', delay: '0s' },
      { property: 'opacity', duration: '0.3s', easing: 'cubic-bezier(0.2, 0, 0, 1)', delay: '0s' },
    ]);
  });

  it('keeps a transition that only has a delay', () => {
    expect(readTransitions(styles({ 'transition-property': 'opacity', 'transition-delay': '0.2s' }))).toHaveLength(1);
  });
});

describe('formatTransition', () => {
  it('formats property, duration, easing, and delay', () => {
    expect(formatTransition({ property: 'opacity', duration: '0.3s', easing: 'ease-out', delay: '0.1s' })).toBe(
      'opacity · 300 ms · ease-out · delay 100 ms',
    );
    expect(formatTransition({ property: 'transform', duration: '0.6s', easing: 'ease', delay: '0s' })).toBe(
      'transform · 600 ms · ease',
    );
  });
});

describe('readAnimations', () => {
  it('treats animation-name "none" as no animation', () => {
    expect(readAnimations(styles({}))).toEqual([]);
  });

  it('reads an animation', () => {
    expect(
      readAnimations(
        styles({
          'animation-name': 'pulse',
          'animation-duration': '2s',
          'animation-timing-function': 'ease-in-out',
          'animation-delay': '0.5s',
          'animation-iteration-count': 'infinite',
          'animation-direction': 'alternate',
        }),
      ),
    ).toEqual([
      {
        name: 'pulse',
        duration: '2s',
        easing: 'ease-in-out',
        delay: '0.5s',
        iterations: 'infinite',
        direction: 'alternate',
        fillMode: 'none',
        playState: 'running',
        timeline: 'auto',
      },
    ]);
  });
});

describe('formatAnimation', () => {
  const base = {
    name: 'pulse',
    duration: '2s',
    easing: 'ease-in-out',
    delay: '0.5s',
    iterations: 'infinite',
    direction: 'alternate',
    fillMode: 'none',
    playState: 'running',
    timeline: 'auto',
  };

  it('mentions only the parts that differ from the defaults', () => {
    expect(formatAnimation(base)).toBe('pulse · 2 s · ease-in-out · delay 500 ms · repeats forever · alternate');
  });

  it('marks scroll-driven animations', () => {
    expect(
      formatAnimation({ ...base, duration: 'auto', easing: 'linear', delay: '0s', iterations: '1', direction: 'normal', timeline: 'view()' }),
    ).toBe('pulse · auto · linear · scroll-driven: view()');
  });
});
