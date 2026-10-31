// Analysis of real recordings, made in Chrome from fixtures/recording.html with real mouse, click, and
// scroll input. Re-record them with `npm run golden:record` (see scripts/golden/). Timings vary a
// little between recordings, so these check the meaning, not exact milliseconds.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Capture } from '../capture';
import { analyzeCapture } from './analyze';

function analyzeGolden(name: string) {
  const capture = JSON.parse(readFileSync(resolve('fixtures/captures', `${name}.json`), 'utf8')) as Capture;
  return analyzeCapture(capture);
}

describe('analysis of real recordings', () => {
  it('hover card: lifts on hover, returns on leave, children only follow', () => {
    const analysis = analyzeGolden('hover-card');
    expect(analysis.headline).toBe(
      'When the pointer enters, the element moves up 8 px and scales to 1.04 over 300 ms. It returns when the pointer leaves.',
    );
    expect(analysis.followers).toBe(2);
    expect(analysis.segments.map((segment) => segment.cause.trigger)).toEqual(['hover-start', 'hover-end']);
    expect(analysis.segments.every((segment) => segment.cause.mechanism === 'css-transition')).toBe(true);
    // Chrome reported the easing, so nothing is fitted.
    expect(analysis.segments.every((segment) => segment.easing === null)).toBe(true);
  });

  it('toggle: a quick move-and-click counts as a click that adds a class', () => {
    const analysis = analyzeGolden('toggle');
    expect(analysis.headline).toBe('On click, the element moves right 40 px over 200 ms.');
    expect(analysis.segments[0]?.cause).toMatchObject({ trigger: 'click', classChange: { added: ['is-on'] } });
  });

  it('plain block: scrolling alone is not motion', () => {
    expect(analyzeGolden('plain-block').headline).toBe('Nothing moved on its own during the recording.');
  });

  it('scroll-driven block: linked to the scroll position', () => {
    const analysis = analyzeGolden('scroll-block');
    expect(analysis.headline).toMatch(/^As the page scrolls, the element moves up [\d.]+ px per 100 px scrolled\.$/);
    const [link] = analysis.scrollLinks;
    expect(link?.mechanism).toBe('scroll-driven-animation');
    expect(link?.properties[0]?.property).toBe('translateY');
    expect(link?.properties[0]?.perPx).toBeGreaterThan(-0.15);
    expect(link?.properties[0]?.perPx).toBeLessThan(-0.04);
    expect(analysis.segments).toEqual([]);
  });

  it('staggered list: five items, 100 ms apart, from the observed delays', () => {
    const analysis = analyzeGolden('list');
    expect(analysis.headline).toBe('On click, 5 inner elements animate one after another, 100 ms apart.');
    expect(analysis.stagger).toMatchObject({ count: 5, intervalMs: 100, order: 'forward', certainty: 'observed' });
    expect(analysis.segments).toHaveLength(5);
    for (const segment of analysis.segments) {
      expect(segment.durationMs).toBe(500);
      expect(segment.changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'translateY', from: 16, to: 0 }),
          expect.objectContaining({ property: 'opacity', from: 0.25, to: 1 }),
        ]),
      );
    }
  });

  it('JavaScript box: measured motion with a reset jump, driven by inline styles', () => {
    const analysis = analyzeGolden('js-box');
    expect(analysis.headline).toMatch(/^On click, the element moves right 120 px over about (1 s|9[5-9]0 ms)\.$/);
    const [segment] = analysis.segments;
    expect(segment?.changes).toEqual([expect.objectContaining({ property: 'translateX', from: 0, to: 120, jumpedTo: 0 })]);
    expect(segment?.cause).toMatchObject({ trigger: 'click', mechanism: 'javascript' });
    expect(segment?.durationCertainty).toBe('measured');
    // The test page uses 1 - (1 - p)^3, which is GSAP's power2.out.
    expect(segment?.easing).toMatchObject({ quality: 'close', best: { name: 'power2.out' } });
  });

  it('reveal: scrolls into view, the page adds a class, a transition runs', () => {
    const analysis = analyzeGolden('reveal');
    expect(analysis.headline).toBe(
      'When it scrolls into view, the element moves up 24 px and fades in (opacity 0 → 1) over 600 ms.',
    );
    expect(analysis.segments[0]?.cause).toMatchObject({
      trigger: 'enters-viewport',
      classChange: { added: ['is-visible'] },
      confidence: 'high',
    });
  });
});

/** The one gradual motion in a recording of the easing demo (section 8). */
function easedMotion(name: string) {
  const motions = analyzeGolden(name).segments.filter((segment) => !segment.instant);
  expect(motions).toHaveLength(1);
  return motions[0]!;
}

describe('easing of real JavaScript animations', () => {
  it.each([
    ['ease-linear', 'linear', 800],
    ['ease-power2-inout', 'power2.inOut', 800],
    ['ease-power4-out', 'power4.out', 800],
    ['ease-back-out', 'back.out', 800],
    ['ease-elastic-out', 'elastic.out', 1000],
  ] as const)('%s is recognized as %s', (file, name, duration) => {
    const motion = easedMotion(file);
    expect(motion.easing).toMatchObject({ quality: 'close', best: { name } });
    expect(Math.abs(motion.durationMs - duration)).toBeLessThanOrEqual(40);
  });

  it('recognizes a spring and estimates its damping', () => {
    const motion = easedMotion('ease-spring');
    expect(motion.easing?.best.name).toBe('spring');
    expect(motion.easing?.best.spring?.dampingRatio).toBeGreaterThanOrEqual(0.25);
    expect(motion.easing?.best.spring?.dampingRatio).toBeLessThanOrEqual(0.45);
    expect(Math.abs(motion.durationMs - 1200)).toBeLessThanOrEqual(40);
  });

  it('says no common easing fits an unusual curve, and finds a close cubic-bezier', () => {
    const motion = easedMotion('ease-custom');
    expect(motion.easing?.quality).toBe('none');
    expect(motion.easing?.custom?.error).toBeLessThan(0.02);
  });
});

