import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeCapture } from '../analysis/analyze';
import type { Capture } from '../capture';
import { describeStyles } from '../style-groups';
import { cssTransform, gsapEaseForCss, gsapVarsForTransform } from './gsap';
import { buildRecipe } from './recipe';

/** The recipe for one of the real recordings in fixtures/captures. */
function recipeFor(name: string): string {
  const capture = JSON.parse(readFileSync(resolve('fixtures/captures', `${name}.json`), 'utf8')) as Capture;
  const styleRows = describeStyles(capture.observed.element, { display: 'block' }).flatMap((group) => group.rows);
  return buildRecipe({ capture, analysis: analyzeCapture(capture), styleRows });
}

describe('recipes from real recordings', () => {
  it('hover card: plain CSS with the exact transition, no JavaScript', () => {
    const recipe = recipeFor('hover-card');
    expect(recipe).toContain('# Interaction recipe: Hover effect on `div.hover-card`');
    expect(recipe).toContain('transition: transform 300ms ease-out;');
    expect(recipe).toContain('.hover-card:hover {\n  transform: translateY(-8px) scale(1.04);');
    expect(recipe).toContain('Plays step 1 backwards');
    expect(recipe).toContain('No JavaScript library is needed');
    expect(recipe).not.toContain('gsap.fromTo');
  });

  it('toggle: a class toggled from React state, with CSS running the transition', () => {
    const recipe = recipeFor('toggle');
    expect(recipe).toContain('Toggle the `is-on` class');
    expect(recipe).toContain('.toggle.is-on {\n  transform: translateX(40px);');
    expect(recipe).toContain('transition: transform 200ms ease;');
  });

  it('staggered list: one GSAP tween with the observed stagger and exact CSS easing', () => {
    const recipe = recipeFor('list');
    expect(recipe).toContain('gsap.fromTo(items, { y: 16, opacity: 0.25 }, {');
    expect(recipe).toContain('stagger: 0.1,');
    expect(recipe).toContain('duration: 0.5,');
    expect(recipe).toContain("CustomEase.create('captured', '0,0,0.58,1')");
    expect(recipe).toContain('gsap.registerPlugin(useGSAP, CustomEase)');
  });

  it('reveal: ScrollTrigger adds the class, CSS runs both transitions', () => {
    const recipe = recipeFor('reveal');
    expect(recipe).toContain("toggleClass: 'is-visible'");
    expect(recipe).toContain('transition: transform 600ms ease-out, opacity 600ms ease-out;');
    expect(recipe).toContain('.reveal {\n  transform: translateY(24px);\n  opacity: 0;');
  });

  it('scroll-driven block: ScrollTrigger scrub with the observed keyframes', () => {
    const recipe = recipeFor('scroll-block');
    expect(recipe).toContain('gsap.fromTo(element, { y: 40 }, {\n  y: -40,');
    expect(recipe).toContain('scrub: true');
  });

  it('JavaScript box: a GSAP tween with the fitted ease and the reset', () => {
    const recipe = recipeFor('js-box');
    expect(recipe).toContain("ease: 'power2.out',");
    expect(recipe).toContain('x: 120,');
    expect(recipe).toContain('onComplete: () => gsap.set(element, { x: 0 })');
  });

  it('spring: points to GSAP elastic as an approximation and to Motion for an exact spring', () => {
    const recipe = recipeFor('ease-spring');
    expect(recipe).toContain("type: 'spring', bounce:");
    expect(recipe).toContain("ease: 'elastic.out(1, 0.5)'");
  });

  it('unusual curve: says no common easing fits and uses the closest cubic-bezier', () => {
    const recipe = recipeFor('ease-custom');
    expect(recipe).toContain('No common easing fits');
    expect(recipe).toMatch(/CustomEase\.create\('captured', '[\d.,-]+'\)/);
  });

  it('nothing moved: says so instead of inventing motion', () => {
    expect(recipeFor('plain-block')).toContain('Nothing moved on its own during the recording');
  });

  it('every recipe is labeled, accessible, and leaves out the site address', () => {
    for (const file of readdirSync(resolve('fixtures/captures'))) {
      const recipe = recipeFor(file.replace('.json', ''));
      expect(recipe).toContain('## How sure this is');
      expect(recipe).toContain('prefers-reduced-motion');
      expect(recipe).not.toContain('127.0.0.1');
    }
  });
});

describe('recipe code helpers', () => {
  it('writes CSS transforms in translate, rotate, skew, scale order', () => {
    expect(
      cssTransform(
        [
          { property: 'scale', from: 1, to: 1.04, min: 1, max: 1.04 },
          { property: 'translateY', from: 0, to: -8, min: -8, max: 0 },
        ],
        'to',
      ),
    ).toBe('translateY(-8px) scale(1.04)');
    expect(cssTransform([{ property: 'translateY', from: 0, to: -8, min: -8, max: 0 }], 'from')).toBe('none');
  });

  it('turns simple CSS transforms into GSAP vars', () => {
    expect(gsapVarsForTransform('translateY(40px)')).toBe('{ y: 40 }');
    expect(gsapVarsForTransform('translate(10px, -4px) scale(0.9)')).toBe('{ x: 10, y: -4, scale: 0.9 }');
    expect(gsapVarsForTransform('translateX(50%)')).toBeNull();
  });

  it('converts CSS easings to GSAP', () => {
    expect(gsapEaseForCss('linear')).toEqual({ code: "'none'", customEase: null });
    expect(gsapEaseForCss('ease-out')).toEqual({ code: 'capturedEase', customEase: '0,0,0.58,1' });
    expect(gsapEaseForCss('cubic-bezier(0.2, 0, 0, 1)')).toEqual({ code: 'capturedEase', customEase: '0.2,0,0,1' });
    expect(gsapEaseForCss('steps(4, end)')).toBeNull();
  });
});
