import { describeCause, describeEasingFit, formatDuration, formatPropertyChange, triggerPhrase } from '../analysis/describe';
import type { InteractionAnalysis, MotionSegment, ScrollLink, UserTrigger } from '../analysis/types';
import { TOLERANCE } from '../analysis/values';
import type { Capture } from '../capture';
import { formatNumber } from '../css-values';
import { formatElementName, formatElementSize } from '../element-summary';
import type { AnimationRecord } from '../recording';
import { overallEasing } from '../recording-evidence';
import type { StyleRow } from '../style-groups';
import {
  codeNumber,
  cssDeclarations,
  cssSelector,
  gsapEaseForCss,
  gsapEntries,
  gsapVars,
  gsapVarsForTransform,
  seconds,
  transitionedProperties,
  unitOf,
} from './gsap';

export interface RecipeInput {
  capture: Capture;
  analysis: InteractionAnalysis;
  /** The element's styles that differ from the browser's defaults (from describeStyles). */
  styleRows: readonly StyleRow[];
}

/** One trigger and everything it set in motion. */
interface Step {
  number: number;
  trigger: UserTrigger;
  segments: MotionSegment[];
  /** This step undoes an earlier one, e.g. a hover-out. */
  reverses: Step | null;
}

const TITLES: Record<UserTrigger, string> = {
  'hover-start': 'Hover effect',
  'hover-end': 'Pointer-leave effect',
  'pointer-down': 'Press effect',
  click: 'Click animation',
  'enters-viewport': 'Reveal on scroll',
  scroll: 'Scroll animation',
  none: 'Autoplay animation',
};

/** Style rows worth passing on. The transform itself is left out: it's the animated value, covered below. */
const STYLE_LABELS = new Set(['Display', 'Position', 'Overflow', 'Z-index', 'Origin', 'Perspective', 'Corner radius', 'Filter', 'Clip path']);

/**
 * A Markdown prompt that tells an AI coding agent how to recreate the
 * interaction in React + GSAP, using plain CSS where CSS is enough. Built only
 * from the capture and its analysis. Every fact keeps its label.
 */
export function buildRecipe({ capture, analysis, styleRows }: RecipeInput): string {
  const element = capture.observed.element.element;
  const name = formatElementName(element);
  const selector = cssSelector(element);
  const steps = groupSteps(analysis.segments);
  const links = analysis.scrollLinks;
  // Filled in while writing the steps: which GSAP plugins the code uses. Empty means CSS alone is enough.
  const plugins = new Set<string>();

  const lines: string[] = [];
  const title = links.length > 0 ? 'Scroll-linked motion' : analysis.stagger ? 'Staggered animation' : TITLES[steps[0]?.trigger ?? 'none'];
  lines.push(`# Interaction recipe: ${title} on \`${name}\``, '', analysis.headline, '');
  lines.push(
    'Build it with **React + GSAP**, using plain CSS where CSS is enough (noted below). Apply the motion to this project’s own component and design tokens. The original page’s content, colors, fonts, and markup weren’t captured; don’t try to copy them.',
    '',
  );

  lines.push('## The element', '');
  const size = capture.observed.element.layoutSize ?? element;
  lines.push(`- \`${name}\`, ${formatElementSize(size)} px on the captured page (size it to fit your layout) *(Observed)*`);
  const styles = styleRows.filter((row) => STYLE_LABELS.has(row.label));
  if (styles.length > 0) {
    lines.push(`- Styles that matter: ${styles.map((row) => `${row.label.toLowerCase()} ${row.value}`).join('; ')} *(Observed)*`);
  }
  if (analysis.followers > 0) {
    lines.push(`- ${analysis.followers} inner ${analysis.followers === 1 ? 'element moves' : 'elements move'} along with it; ${analysis.followers === 1 ? 'it doesn’t' : 'they don’t'} animate on ${analysis.followers === 1 ? 'its' : 'their'} own *(Measured)*`);
  }
  lines.push('');

  lines.push('## Motion', '');
  if (steps.length === 0 && links.length === 0) {
    lines.push('Nothing moved on its own during the recording, so there is no motion to recreate. Record the interaction again, and make sure to trigger it while recording.', '');
  }
  let number = 0;
  for (const link of links) {
    number++;
    lines.push(...scrollLinkSection(number, link, capture, plugins), '');
  }
  for (const step of steps) {
    step.number = ++number;
    lines.push(...stepSection(step, analysis, selector, plugins), '');
  }

  lines.push('## Setup *(Recommended)*', '');
  if (plugins.size === 0) {
    lines.push('- No JavaScript library is needed: the CSS above is the whole interaction.', '');
  } else {
    const imports = ["import gsap from 'gsap';", "import { useGSAP } from '@gsap/react';"];
    if (plugins.has('ScrollTrigger')) imports.push("import { ScrollTrigger } from 'gsap/ScrollTrigger';");
    if (plugins.has('CustomEase')) imports.push("import { CustomEase } from 'gsap/CustomEase';");
    lines.push(
      '- `npm install gsap @gsap/react`',
      `- Import and register once: ${imports.map((line) => `\`${line}\``).join(' ')} then \`gsap.registerPlugin(${['useGSAP', ...[...plugins].filter((plugin) => plugin !== 'useGSAP')].join(', ')})\``,
      '- Create tweens inside `useGSAP()`, scoped to the component’s container. Wrap event handlers with its `contextSafe` so they’re cleaned up on unmount.',
      '',
    );
  }

  lines.push('## How sure this is', '');
  lines.push(...confidence(analysis), '');

  lines.push('## Accessibility *(Recommended)*', '');
  lines.push(
    '- Respect `prefers-reduced-motion`: in CSS, put the motion inside `@media (prefers-reduced-motion: no-preference)`; in GSAP, use `gsap.matchMedia()` to skip or shorten it.',
  );
  if (steps.some((step) => step.trigger === 'hover-start' || step.trigger === 'hover-end')) {
    lines.push('- Keep hover-only effects decorative, or give them a keyboard equivalent (`:focus-visible`).');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

/** Groups motions by their trigger, and spots steps that undo an earlier one. */
function groupSteps(segments: readonly MotionSegment[]): Step[] {
  const steps: Step[] = [];
  for (const segment of segments) {
    if (segment.instant) continue;
    const { trigger, triggerAt } = segment.cause;
    const step = steps.find(
      (candidate) =>
        candidate.trigger === trigger &&
        sameMoment(candidate.segments[0]?.cause.triggerAt ?? null, triggerAt),
    );
    if (step) step.segments.push(segment);
    else steps.push({ number: 0, trigger, segments: [segment], reverses: null });
  }
  for (const [index, step] of steps.entries()) {
    step.reverses = steps.slice(0, index).find((earlier) => undoes(earlier, step)) ?? null;
  }
  return steps;
}

function sameMoment(a: number | null, b: number | null): boolean {
  return a === null || b === null ? a === b : Math.abs(a - b) <= 50;
}

function undoes(earlier: Step, later: Step): boolean {
  const first = earlier.segments[0];
  const second = later.segments.find((segment) => segment.element === first?.element);
  const main = first?.changes[0];
  const match = second?.changes.find((change) => change.property === main?.property);
  return !!main && !!match && Math.abs(match.to - main.from) <= TOLERANCE[main.property] * 4;
}

function stepSection(step: Step, analysis: InteractionAnalysis, selector: string, plugins: Set<string>): string[] {
  const lead = step.segments[0];
  if (!lead) return [];
  const heading = `### ${step.number}. ${triggerPhrase(step.trigger)}`;

  if (step.reverses) {
    return [
      heading,
      '',
      `- Plays step ${step.reverses.number} backwards: ${lead.changes.map(formatPropertyChange).join(', ')}.`,
      `- Duration: ${duration(lead)}; easing: ${easingText(lead)}`,
      `- ${describeCause(lead.cause)} *(Estimated, ${lead.cause.confidence} confidence)*`,
    ];
  }

  const stagger =
    analysis.stagger && step.segments.length >= analysis.stagger.count && step.segments.every((segment) => segment.element !== 0)
      ? analysis.stagger
      : null;
  const lines = [heading, ''];
  lines.push(`- What starts it: ${describeCause(lead.cause)} *(Estimated, ${lead.cause.confidence} confidence)*`);
  if (stagger) {
    const subject = stagger.subjects[0] ?? 'item';
    lines.push(
      `- What moves: ${stagger.count} inner \`${subject}\` elements, one after another, ${stagger.intervalMs} ms apart, ${stagger.order === 'forward' ? 'in page order' : 'last one first'} *(${label(stagger.certainty)})*`,
      '- Each one changes *(Measured)*:',
    );
  } else {
    lines.push(`- What moves: ${step.segments.map((segment) => (segment.element === 0 ? 'the element' : `\`${segment.subject}\``)).join(', ')}`);
    lines.push('- Changes *(Measured)*:');
  }
  lines.push(...lead.changes.map((change) => `  - ${formatPropertyChange(change)}`));
  lines.push(`- Duration: ${duration(lead)}${stagger ? ' each' : ''}`);
  const delay = lead.cause.animation?.delayMs ?? 0;
  if (!stagger && delay > 0) lines.push(`- Delay: ${formatNumber(delay, 0)} ms *(Observed)*`);
  lines.push(`- Easing: ${easingText(lead)}`);
  const resetTo = lead.changes.find((change) => change.jumpedTo !== undefined);
  if (resetTo) lines.push('- When it ends, it jumps straight back to where it started *(Measured)*');

  lines.push('', '**How to build it** *(Recommended)*', '');
  lines.push(...buildInstructions(step, lead, stagger?.intervalMs ?? null, selector, plugins));
  return lines;
}

function buildInstructions(
  step: Step,
  lead: MotionSegment,
  staggerMs: number | null,
  selector: string,
  plugins: Set<string>,
): string[] {
  const { cause } = lead;
  const cssEasing = cssTimingFunction(lead);
  const isCss = cause.mechanism === 'css-transition';
  const durationMs = Math.round(lead.durationMs);

  // A CSS :hover transition: CSS alone recreates it, including playing back when the pointer leaves.
  if (step.trigger === 'hover-start' && isCss && !cause.classChange && cssEasing) {
    return [
      'Plain CSS is enough. The browser plays the transition back when the pointer leaves:',
      '',
      '```css',
      `${selector} {`,
      ...cssDeclarations(lead.changes, 'from').map((line) => `  ${line}`),
      `  transition: ${transitionedProperties(lead.changes).map((property) => `${property} ${durationMs}ms ${cssEasing}`).join(', ')};`,
      '}',
      `${selector}:hover {`,
      ...cssDeclarations(lead.changes, 'to').map((line) => `  ${line}`),
      '}',
      '```',
    ];
  }

  // A class change starts a CSS transition: toggle the class, and let CSS run the motion.
  const className = cause.classChange?.added[0];
  if (className && isCss && cssEasing && !staggerMs) {
    const css = [
      '```css',
      `${selector} {`,
      ...cssDeclarations(lead.changes, 'from').map((line) => `  ${line}`),
      `  transition: ${transitionedProperties(lead.changes).map((property) => `${property} ${durationMs}ms ${cssEasing}`).join(', ')};`,
      '}',
      `${selector}.${className} {`,
      ...cssDeclarations(lead.changes, 'to').map((line) => `  ${line}`),
      '}',
      '```',
    ];
    if (step.trigger === 'enters-viewport') {
      plugins.add('useGSAP');
      plugins.add('ScrollTrigger');
      return [
        `Let GSAP's ScrollTrigger add the \`${className}\` class when the element scrolls into view, and let CSS run the transition:`,
        '',
        '```js',
        `ScrollTrigger.create({ trigger: element, start: 'top bottom', toggleClass: '${className}' });`,
        '```',
        '',
        ...css,
      ];
    }
    return [
      `Toggle the \`${className}\` class (or a data attribute) from React state ${eventPhrase(step.trigger)}, and let CSS run the transition:`,
      '',
      ...css,
    ];
  }

  // Everything else: a GSAP tween with the captured values.
  const ease = gsapEase(lead);
  plugins.add('useGSAP');
  if (ease.customEase) plugins.add('CustomEase');
  if (step.trigger === 'enters-viewport') plugins.add('ScrollTrigger');
  const vars = [`duration: ${seconds(durationMs)}`, `ease: ${ease.code}`];
  if (staggerMs) vars.push(`stagger: ${seconds(staggerMs)}`);
  const delay = lead.cause.animation?.delayMs ?? 0;
  if (!staggerMs && delay > 0) vars.push(`delay: ${seconds(delay)}`);
  const reset = lead.changes.some((change) => change.jumpedTo !== undefined);
  if (reset) vars.push(`onComplete: () => gsap.set(${staggerMs ? 'items' : 'element'}, ${gsapVars(lead.changes, 'from')})`);
  if (step.trigger === 'enters-viewport') {
    vars.push("scrollTrigger: { trigger: element, start: 'top bottom', toggleActions: 'play none none none' }");
  }
  const target = staggerMs ? 'items' : 'element';
  const code = [
    ...(ease.customEase ? [`const capturedEase = CustomEase.create('captured', '${ease.customEase}');`] : []),
    `gsap.fromTo(${target}, ${gsapVars(lead.changes, 'from')}, {`,
    ...[...gsapEntries(lead.changes, 'to'), ...vars].map((entry) => `  ${entry},`),
    '});',
  ];
  return [
    `Use a GSAP tween, ${tweenPlacement(step.trigger)}${staggerMs ? '. `items` are the inner elements, in page order' : ''}:`,
    '',
    '```js',
    ...code,
    '```',
    ...(ease.note ? ['', ease.note] : []),
  ];
}

function scrollLinkSection(number: number, link: ScrollLink, capture: Capture, plugins: Set<string>): string[] {
  plugins.add('useGSAP');
  plugins.add('ScrollTrigger');
  const lines = [`### ${number}. While the page scrolls`, ''];
  lines.push(`- ${link.subject === 'the element' ? 'The element' : `\`${link.subject}\``} follows the scroll position instead of time *(Measured)*:`);
  for (const property of link.properties) {
    const unit = unitOf(property.property);
    lines.push(
      `  - ${property.property}: ${codeNumber(property.property, property.perPx * 100)}${unit} per 100 px scrolled (seen from ${codeNumber(property.property, property.min)} to ${codeNumber(property.property, property.max)}${unit})`,
    );
  }
  const keyframes = link.animation ? keyframeRange(link.animation) : null;
  if (link.animation) {
    lines.push(
      `- Driven by a scroll-driven CSS animation ("${link.animation.name}") *(Observed)*${keyframes ? `: from \`${keyframes.from}\` to \`${keyframes.to}\` while the element crosses the viewport` : ''}`,
    );
  } else if (link.mechanism === 'javascript') {
    lines.push('- Driven by JavaScript, which changes its inline style while scrolling *(Estimated)*');
  }

  // ScrollTrigger from "top bottom" to "bottom top" covers the viewport height plus the element's height.
  const height = capture.observed.element.layoutSize?.height ?? capture.observed.element.element.height;
  const distance = capture.measured?.recording.viewport.height ? capture.measured.recording.viewport.height + height : null;
  const main = link.properties[0];
  lines.push('', '**How to build it** *(Recommended)*', '');
  if (keyframes) {
    const from = gsapVarsForTransform(keyframes.from) ?? `{ transform: '${keyframes.from}' }`;
    const to = gsapVarsForTransform(keyframes.to) ?? `{ transform: '${keyframes.to}' }`;
    lines.push(
      `Use ScrollTrigger with \`scrub\`, mapping the captured keyframes across the element’s pass through the viewport. (CSS scroll-driven animations do this too, but not every browser supports them yet.)`,
      '',
      '```js',
      `gsap.fromTo(element, ${from}, {`,
      `  ${to.slice(2, -2)},`,
      "  ease: 'none',",
      "  scrollTrigger: { trigger: element, start: 'top bottom', end: 'bottom top', scrub: true },",
      '});',
      '```',
    );
  } else if (main && distance) {
    const travel = main.perPx * distance;
    const property = main.property === 'translateY' || main.property === 'moveY' ? 'y' : main.property === 'translateX' || main.property === 'moveX' ? 'x' : main.property;
    lines.push(
      'Use ScrollTrigger with `scrub`, so the value follows the scroll position exactly:',
      '',
      '```js',
      `gsap.to(element, {`,
      `  ${property}: ${codeNumber(main.property, travel)}, // ${codeNumber(main.property, main.perPx * 100)} per 100 px over about ${formatNumber(distance, 0)} px of scrolling`,
      "  ease: 'none',",
      "  scrollTrigger: { trigger: element, start: 'top bottom', end: 'bottom top', scrub: true },",
      '});',
      '```',
    );
  }
  return lines;
}

/** The first and last transform keyframes of a CSS animation, when they're simple strings. */
function keyframeRange(animation: AnimationRecord): { from: string; to: string } | null {
  const transforms = animation.keyframes.map((keyframe) => keyframe.values.transform).filter((value): value is string => !!value);
  const from = transforms[0];
  const to = transforms[transforms.length - 1];
  return from && to && from !== to ? { from, to } : null;
}

function duration(segment: MotionSegment): string {
  return `${formatDuration(segment.durationMs, segment.durationCertainty)} *(${label(segment.durationCertainty)})*`;
}

function easingText(segment: MotionSegment): string {
  if (segment.cause.animation) return `\`${overallEasing(segment.cause.animation)}\` *(Observed)*`;
  if (segment.easing) {
    const { summary, detail } = describeEasingFit(segment.easing);
    return `${summary.replace(/^Easing ≈ /, '≈ ')}${detail ? ` ${detail}.` : ''} *(Estimated)*`;
  }
  return 'not known *(the motion was too short or irregular to fit)*';
}

/** The CSS timing function for a segment: observed exactly, or from the fitted curve when CSS has one. */
function cssTimingFunction(segment: MotionSegment): string | null {
  if (segment.cause.animation) return overallEasing(segment.cause.animation);
  const fit = segment.easing;
  if (!fit) return null;
  return fit.quality === 'none' ? (fit.custom?.css ?? null) : fit.best.css;
}

function gsapEase(segment: MotionSegment): { code: string; customEase: string | null; note: string | null } {
  if (segment.cause.animation) {
    const css = overallEasing(segment.cause.animation);
    const converted = gsapEaseForCss(css);
    if (converted) return { ...converted, note: converted.customEase ? `\`capturedEase\` is the captured CSS easing \`${css}\`, recreated exactly.` : null };
    return { code: "'power1.out'", customEase: null, note: `The captured easing \`${css}\` has no direct GSAP form; \`power1.out\` is a placeholder to adjust by eye.` };
  }
  const fit = segment.easing;
  if (!fit) return { code: "'power1.out'", customEase: null, note: 'The easing couldn’t be measured; `power1.out` is a placeholder to adjust by eye.' };
  if (fit.quality === 'none' && fit.custom) {
    const curve = /^cubic-bezier\(([^)]+)\)$/.exec(fit.custom.css)?.[1]?.replace(/\s+/g, '') ?? null;
    return { code: 'capturedEase', customEase: curve, note: 'No common easing fits; `capturedEase` is the closest cubic-bezier to the measured curve.' };
  }
  if (fit.best.spring) {
    const bounce = formatNumber(1 - fit.best.spring.dampingRatio, 2);
    return {
      code: "'elastic.out(1, 0.5)'",
      customEase: null,
      note: `The motion is a spring (damping ratio ${formatNumber(fit.best.spring.dampingRatio, 2)}). GSAP has no spring ease: \`elastic.out\` is the closest family, so tune it by eye, or use Motion’s \`{ type: 'spring', bounce: ${bounce} }\` for this one element.`,
    };
  }
  if (fit.best.gsap) return { code: `'${fit.best.gsap}'`, customEase: null, note: null };
  const converted = fit.best.css ? gsapEaseForCss(fit.best.css) : null;
  return converted ? { ...converted, note: null } : { code: "'power1.out'", customEase: null, note: null };
}

function eventPhrase(trigger: UserTrigger): string {
  switch (trigger) {
    case 'click':
      return 'in an `onClick` handler';
    case 'pointer-down':
      return 'in an `onPointerDown` handler';
    case 'hover-start':
    case 'hover-end':
      return 'in `onMouseEnter` / `onMouseLeave` handlers';
    default:
      return 'when the trigger happens';
  }
}

function tweenPlacement(trigger: UserTrigger): string {
  switch (trigger) {
    case 'click':
      return 'started from an `onClick` handler wrapped in `contextSafe`';
    case 'pointer-down':
      return 'started from an `onPointerDown` handler wrapped in `contextSafe`';
    case 'hover-start':
      return 'started from an `onMouseEnter` handler wrapped in `contextSafe` (reverse it on `onMouseLeave`)';
    case 'hover-end':
      return 'started from an `onMouseLeave` handler wrapped in `contextSafe`';
    case 'enters-viewport':
      return 'created in `useGSAP` with a ScrollTrigger that plays it when the element scrolls into view';
    case 'scroll':
      return 'created in `useGSAP` with a ScrollTrigger at the scroll position where it should start';
    case 'none':
      return 'created in `useGSAP`, so it plays when the component mounts';
  }
}

function confidence(analysis: InteractionAnalysis): string[] {
  const motions = analysis.segments.filter((segment) => !segment.instant);
  const lines: string[] = [];
  const observed: string[] = [];
  if (motions.some((segment) => segment.cause.animation) || analysis.scrollLinks.some((link) => link.animation)) {
    observed.push('the CSS animations’ and transitions’ timing, easing, and keyframes');
  }
  if (motions.some((segment) => segment.cause.classChange)) observed.push('the class changes');
  if (analysis.stagger?.certainty === 'observed') observed.push('the stagger delays');
  observed.push('the element’s styles');
  lines.push(`- **Observed** values were read directly from Chrome: ${LIST.format(observed)}. Use them as they are.`);
  lines.push('- **Measured** values were sampled from the screen while recording: start and end values, movement, and scroll rates. Expect them to be within about one frame (17 ms) and a fraction of a pixel.');
  lines.push(
    `- **Estimated** values were inferred, so treat them as a strong starting point, not a fact: what triggered each motion${motions.some((segment) => segment.easing) ? ', and the fitted easing curves' : ''}.`,
  );
  lines.push('- **Recommended** parts are suggestions for building it, not something seen on the page.');
  for (const note of analysis.notes) lines.push(`- Note: ${note}`);
  lines.push('- Not captured: the site’s own code (for example its GSAP timelines), content, colors, fonts, and markup.');
  return lines;
}

const LIST = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

function label(certainty: 'observed' | 'measured'): string {
  return certainty === 'observed' ? 'Observed' : 'Measured';
}

