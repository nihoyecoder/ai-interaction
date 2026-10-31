import { describe, expect, it } from 'vitest';
import { createCapture } from '../capture';
import { createElementSnapshot, INITIAL_STYLE_VALUES } from '../element-snapshot';
import {
  createAnimationRecord,
  createEmptyRecording,
  type AnimationRecord,
  type ElementSample,
  type Recording,
  type ScrollSample,
} from '../recording';
import { analyzeCapture } from './analyze';

const FRAME = 1000 / 60;
const card = { tag: 'div', id: null, classes: ['card'] };
const item = { tag: 'li', id: null, classes: [] };
const easeOut = (p: number) => 1 - (1 - p) ** 3;
const matrix = (scale: number, tx: number, ty: number) =>
  scale === 1 && tx === 0 && ty === 0 ? 'none' : `matrix(${scale}, 0, 0, ${scale}, ${tx}, ${ty})`;

const snapshot = createElementSnapshot({
  tag: 'div',
  id: '',
  classes: ['card'],
  namespace: 'html',
  rect: { left: 0, top: 0, width: 200, height: 100 },
  scroll: { x: 0, y: 0 },
  layoutSize: { width: 200, height: 100 },
  path: [],
  styles: INITIAL_STYLE_VALUES,
  type: null,
  open: false,
  hovered: false,
  canSelectParent: true,
  canSelectChild: true,
});

function analyze(overrides: Partial<Recording>) {
  const recording: Recording = {
    ...createEmptyRecording('user'),
    durationMs: 4000,
    frameCount: 240,
    viewport: { width: 1200, height: 800 },
    elements: [{ name: card, depth: 0 }],
    scroll: [{ t: 0, area: -1, x: 0, y: 0 }],
    ...overrides,
  };
  return analyzeCapture(
    createCapture({ hostname: 'example.com', extensionVersion: '0', snapshot, recording, exportedAt: new Date(0) }),
  );
}

function at(t: number, element: number, overrides: Partial<ElementSample> = {}): ElementSample {
  return { t: Math.round(t * 10) / 10, element, x: 100, y: 300, width: 200, height: 100, transform: 'none', opacity: 1, ...overrides };
}

/** One sample per frame from `start` (exclusive) to `start + duration`, with progress 0–1 passed to `state`. */
function frames(start: number, duration: number, element: number, state: (progress: number) => Partial<ElementSample>) {
  const samples: ElementSample[] = [];
  for (let t = start + FRAME; t < start + duration + FRAME / 2; t += FRAME) {
    samples.push(at(Math.min(t, start + duration), element, state(Math.min(1, (t - start) / duration))));
  }
  return samples;
}

function animation(overrides: Partial<Parameters<typeof createAnimationRecord>[0]>): AnimationRecord {
  return createAnimationRecord({
    t: 0,
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
    keyframes: [],
    ...overrides,
  });
}

const byTime = (a: ElementSample, b: ElementSample) => a.t - b.t || a.element - b.element;

describe('analyzeCapture', () => {
  it('says when nothing moved', () => {
    const analysis = analyze({ samples: [at(0, 0)] });
    expect(analysis.headline).toBe('Nothing moved on its own during the recording.');
    expect(analysis.segments).toEqual([]);
  });

  it('understands a hover lift that reverses, and ignores children that move along', () => {
    const lift = (p: number) => ({ transform: matrix(1 + 0.04 * easeOut(p), 0, -8 * easeOut(p)) });
    const drop = (p: number) => ({ transform: matrix(1.04 - 0.04 * easeOut(p), 0, -8 + 8 * easeOut(p)) });
    const child = (dy: (p: number) => number) => (p: number) => ({ y: 320 + dy(p) });
    const samples = [
      at(0, 0),
      at(0, 1, { y: 320 }),
      at(0, 2, { y: 340 }),
      ...frames(500, 300, 0, lift),
      ...frames(500, 300, 1, child((p) => -8 * easeOut(p))),
      ...frames(1500, 300, 0, drop),
      ...frames(1500, 300, 1, child((p) => -8 + 8 * easeOut(p))),
    ].sort(byTime);

    const analysis = analyze({
      elements: [
        { name: card, depth: 0 },
        { name: { tag: 'strong', id: null, classes: [] }, depth: 1 },
        { name: { tag: 'span', id: null, classes: [] }, depth: 1 },
      ],
      samples,
      hover: [
        { t: 500, hovered: true },
        { t: 1500, hovered: false },
      ],
      animations: [animation({ t: 500 }), animation({ t: 1500 })],
    });

    expect(analysis.headline).toBe(
      'When the pointer enters, the element moves up 8 px and scales to 1.04 over 300 ms. It returns when the pointer leaves.',
    );
    expect(analysis.followers).toBe(1);
    expect(analysis.segments).toHaveLength(2);
    expect(analysis.segments[0]?.cause).toMatchObject({ trigger: 'hover-start', mechanism: 'css-transition', confidence: 'high' });
    expect(analysis.segments[0]?.changes).toEqual([
      { property: 'translateY', from: 0, to: -8, min: -8, max: 0 },
      { property: 'scale', from: 1, to: 1.04, min: 1, max: 1.04 },
    ]);
    expect(analysis.segments[1]?.cause.trigger).toBe('hover-end');
  });

  it('follows a click through a class change to a CSS transition', () => {
    const analysis = analyze({
      samples: [at(0, 0), ...frames(1100, 200, 0, (p) => ({ transform: matrix(1, 40 * easeOut(p), 0) }))],
      presses: [
        { t: 1000, type: 'press', x: 0, y: 0, onElement: true },
        { t: 1080, type: 'release', x: 0, y: 0, onElement: true },
      ],
      classChanges: [{ t: 1082, element: 0, target: card, added: ['is-on'], removed: [] }],
      animations: [animation({ t: 1100, duration: 200, easing: 'ease' })],
    });

    expect(analysis.headline).toBe('On click, the element moves right 40 px over 200 ms.');
    expect(analysis.segments[0]?.cause).toMatchObject({
      trigger: 'click',
      triggerAt: 1080,
      classChange: { added: ['is-on'], removed: [], at: 1082 },
      confidence: 'high',
    });
  });

  it('treats moving onto a button and clicking at once as a click, not a hover', () => {
    // The hover is only noticed at the next frame, after the click's exact event time.
    const analysis = analyze({
      samples: [at(0, 0), ...frames(1033, 200, 0, (p) => ({ transform: matrix(1, 40 * easeOut(p), 0) }))],
      hover: [{ t: 1016.7, hovered: true }],
      presses: [
        { t: 1004, type: 'press', x: 0, y: 0, onElement: true },
        { t: 1006, type: 'release', x: 0, y: 0, onElement: true },
      ],
      classChanges: [{ t: 1008, element: 0, target: card, added: ['is-on'], removed: [] }],
      animations: [animation({ t: 1016.7, duration: 200 })],
    });
    expect(analysis.segments[0]?.cause.trigger).toBe('click');
  });

  it('finds a stagger from the observed animation delays', () => {
    const created = 1016.7;
    const elements = [{ name: { tag: 'ul', id: null, classes: ['list'] }, depth: 0 }];
    const samples: ElementSample[] = [at(0, 0)];
    const animations: AnimationRecord[] = [];
    for (let index = 0; index < 5; index++) {
      const element = index + 1;
      elements.push({ name: item, depth: 1 });
      samples.push(at(0, element, { opacity: 0.25 }));
      // fill: both applies the first keyframe as soon as the animation is created.
      samples.push(at(created, element, { opacity: 0.25, transform: matrix(1, 0, 16) }));
      samples.push(
        ...frames(created + index * 100, 500, element, (p) => ({
          opacity: 0.25 + 0.75 * easeOut(p),
          transform: matrix(1, 0, 16 - 16 * easeOut(p)),
        })),
      );
      animations.push(
        animation({
          t: created,
          element,
          target: item,
          kind: 'css-animation',
          name: 'pop',
          duration: 500,
          delay: index * 100,
          easing: 'linear',
          fill: 'both',
          keyframes: [{ offset: 0, easing: 'ease-out', opacity: '0.25' }],
        }),
      );
    }

    const analysis = analyze({
      elements,
      samples: samples.sort(byTime),
      presses: [{ t: 1000, type: 'release', x: 0, y: 0, onElement: false }],
      classChanges: [{ t: 1001, element: 0, target: elements[0]!.name, added: ['is-playing'], removed: [] }],
      animations,
    });

    expect(analysis.headline).toBe('On click, 5 inner elements animate one after another, 100 ms apart.');
    expect(analysis.stagger).toMatchObject({ count: 5, intervalMs: 100, order: 'forward', certainty: 'observed' });
    // The jumps to the first keyframe are folded into each motion.
    expect(analysis.segments).toHaveLength(5);
    expect(analysis.segments[0]?.changes[0]).toMatchObject({ property: 'translateY', from: 16, to: 0, jumpedFrom: 0 });
    expect(analysis.segments[1]?.changes[0]).toMatchObject({ property: 'translateY', from: 16, to: 0 });
    expect(analysis.segments[1]?.durationMs).toBe(500);
  });

  it('recognizes a reveal when the element scrolls into view', () => {
    const samples: ElementSample[] = [];
    const scroll: ScrollSample[] = [{ t: 0, area: -1, x: 0, y: 0 }];
    const reveal = 467;
    let entered: number | null = null;
    for (let t = 0; t <= 1600; t += FRAME) {
      const scrollY = Math.min(400, t / 2);
      if (t > 0 && scrollY > (scroll[scroll.length - 1]?.y ?? 0)) scroll.push({ t: Math.round(t * 10) / 10, area: -1, x: 0, y: scrollY });
      const progress = t <= reveal + 33 ? 0 : Math.min(1, (t - reveal - 33) / 600);
      const ty = 24 - 24 * easeOut(progress);
      const y = 1000 - scrollY + ty;
      if (entered === null && y < 800) entered = t;
      samples.push(at(t, 0, { y, opacity: easeOut(progress), transform: matrix(1, 0, ty) }));
    }

    const analysis = analyze({
      samples,
      scroll,
      classChanges: [{ t: reveal + 20, element: 0, target: card, added: ['is-visible'], removed: [] }],
      animations: [
        animation({ t: reveal + 33, name: 'opacity', duration: 600 }),
        animation({ t: reveal + 33, name: 'transform', duration: 600 }),
      ],
    });

    expect(entered).not.toBeNull();
    expect(analysis.headline).toBe(
      'When it scrolls into view, the element moves up 24 px and fades in (opacity 0 → 1) over 600 ms.',
    );
    expect(analysis.segments[0]?.cause).toMatchObject({
      trigger: 'enters-viewport',
      classChange: { added: ['is-visible'] },
    });
    expect(analysis.scrollLinks).toEqual([]);
  });

  it('measures JavaScript parallax as scroll-linked', () => {
    const samples: ElementSample[] = [at(0, 0)];
    const scroll: ScrollSample[] = [{ t: 0, area: -1, x: 0, y: 0 }];
    for (let t = FRAME; t <= 1000; t += FRAME) {
      const scrollY = Math.round(t * 0.6);
      scroll.push({ t: Math.round(t * 10) / 10, area: -1, x: 0, y: scrollY });
      const ty = -0.3 * scrollY;
      samples.push(at(t, 0, { y: 300 - scrollY + ty, transform: matrix(1, 0, ty) }));
    }

    const analysis = analyze({ samples, scroll, styleWrites: [{ element: 0, target: card, count: 60 }] });

    expect(analysis.headline).toBe('As the page scrolls, the element moves up 30 px per 100 px scrolled.');
    expect(analysis.scrollLinks[0]).toMatchObject({ mechanism: 'javascript' });
    expect(analysis.scrollLinks[0]?.properties[0]?.perPx).toBeCloseTo(-0.3, 3);
    expect(analysis.segments).toEqual([]);
  });

  it('measures a JavaScript animation, including a reset jump at the end', () => {
    const start = 1000;
    const analysis = analyze({
      samples: [
        at(0, 0),
        ...frames(start, 1000, 0, (p) => ({ transform: matrix(1, 120 * easeOut(p), 0) })),
        at(start + 1000 + FRAME, 0),
      ],
      presses: [{ t: start - 10, type: 'release', x: 0, y: 0, onElement: false }],
      styleWrites: [{ element: 0, target: card, count: 61 }],
    });

    expect(analysis.headline).toBe('On click, the element moves right 120 px over about 1 s.');
    const [segment] = analysis.segments;
    expect(segment?.changes).toEqual([{ property: 'translateX', from: 0, to: 120, min: 0, max: 120, jumpedTo: 0 }]);
    expect(segment?.cause).toMatchObject({ trigger: 'click', mechanism: 'javascript', confidence: 'high' });
    expect(segment?.durationCertainty).toBe('measured');
    expect(analysis.notes.some((note) => note.includes('one frame'))).toBe(true);
    // 1 - (1 - p)^3 is GSAP's power2.out.
    expect(segment?.easing).toMatchObject({ property: 'translateX', quality: 'close', best: { name: 'power2.out' } });
  });
});
