import { describe, expect, it } from 'vitest';
import { cubicBezier, fitEasing, NAMED_EASINGS, springEase, type Ease, type ProgressPoint } from './easing';
import { describeEasingFit } from './describe';

const FRAME = 1000 / 60;

/**
 * What the recorder sees when a script animates 240 px with `ease`: one value
 * per frame, frames starting at an unknown offset after the animation began,
 * values rounded like Chrome's computed styles, and only frames that changed.
 */
function measure(ease: Ease, duration = 800, offset = 7): ProgressPoint[] {
  const start = 1000;
  const points: ProgressPoint[] = [];
  let last: number | null = null;
  for (let t = start + offset; t <= start + duration + FRAME; t += FRAME) {
    const value = Math.round(ease(Math.min(1, (t - start) / duration)) * 240 * 1000) / 1000;
    if (value === last) continue;
    last = value;
    points.push({ t, p: value / 240 });
  }
  return points;
}

const named = (name: string) => {
  const easing = NAMED_EASINGS.find((candidate) => candidate.name === name);
  if (!easing) throw new Error(name);
  return easing.ease;
};

describe('fitEasing', () => {
  it.each(['linear', 'ease-out', 'power2.out', 'power4.out', 'sine.inOut', 'expo.out', 'back.out', 'elastic.out', 'bounce.out'])(
    'recognizes %s',
    (name) => {
      const fit = fitEasing(measure(named(name)), FRAME);
      expect(fit?.best.name).toBe(name);
      expect(fit?.quality).toBe('close');
    },
  );

  it('recognizes a spring and estimates its damping', () => {
    const fit = fitEasing(measure(springEase(0.35, 14), 1200), FRAME);
    expect(fit?.best.name).toBe('spring');
    expect(fit?.best.spring?.dampingRatio).toBeCloseTo(0.35, 1);
    expect(fit?.quality).toBe('close');
  });

  it('says when no common easing fits, and gives the closest cubic-bezier', () => {
    // Fast, then a pause, then fast again: not a common easing.
    const fit = fitEasing(measure(cubicBezier(0.3, 0.9, 0.9, 0.2)), FRAME);
    expect(fit?.quality).toBe('none');
    expect(fit?.custom?.error).toBeLessThan(0.02);
  });

  it('is not thrown off by a reset frame before the motion starts', () => {
    // A script sets translateX(0) one frame before animating, like the test page's easing buttons.
    const points = measure(named('elastic.out'), 1000);
    const withReset = [{ t: (points[0]?.t ?? 0) - FRAME, p: 0 }, ...points];
    expect(fitEasing(withReset, FRAME)?.best.name).toBe('elastic.out');
  });

  it('needs enough of a motion to judge', () => {
    expect(fitEasing([{ t: 0, p: 0 }, { t: 16, p: 1 }], FRAME)).toBeNull();
  });
});

describe('describeEasingFit', () => {
  it('describes a close match with its CSS and GSAP equivalents', () => {
    expect(
      describeEasingFit({
        property: 'translateX',
        quality: 'close',
        best: { name: 'power3.out', gsap: 'power3.out', css: 'cubic-bezier(0.25, 1, 0.5, 1)', error: 0.004 },
        custom: null,
        durationMs: 800,
      }),
    ).toEqual({ summary: 'Easing ≈ power3.out, a close match (0.4% off).', detail: 'CSS ≈ cubic-bezier(0.25, 1, 0.5, 1)' });
  });

  it('describes a spring with its Motion equivalent', () => {
    expect(
      describeEasingFit({
        property: 'translateX',
        quality: 'close',
        best: { name: 'spring', gsap: null, css: null, error: 0.006, spring: { dampingRatio: 0.35 } },
        custom: null,
        durationMs: 1200,
      }),
    ).toEqual({
      summary: 'Easing ≈ a spring (damping ratio 0.35), a close match (0.6% off).',
      detail: 'Motion: type "spring", bounce 0.65',
    });
  });

  it('is honest when nothing fits', () => {
    expect(
      describeEasingFit({
        property: 'translateX',
        quality: 'none',
        best: { name: 'power2.inOut', gsap: 'power2.inOut', css: null, error: 0.081 },
        custom: { css: 'cubic-bezier(0.3, 0.9, 0.9, 0.2)', error: 0.004, durationMs: 800 },
        durationMs: 800,
      }),
    ).toEqual({
      summary: 'No common easing fits. The closest is power2.inOut, 8.1% off.',
      detail: 'Closest curve: cubic-bezier(0.3, 0.9, 0.9, 0.2) (0.4% off)',
    });
  });
});
