import { formatNumber } from '../css-values';
import type {
  Cause,
  Mechanism,
  MotionProperty,
  MotionSegment,
  PropertyChange,
  ScrollLink,
  ScrollLinkedProperty,
  Stagger,
  UserTrigger,
} from './types';
import { TOLERANCE } from './values';

const WHEN: Record<UserTrigger, string> = {
  'hover-start': 'When the pointer enters',
  'hover-end': 'When the pointer leaves',
  'pointer-down': 'On press',
  click: 'On click',
  'enters-viewport': 'When it scrolls into view',
  scroll: 'While the page scrolls',
  none: 'Without any action',
};

const RETURNS: Record<UserTrigger, string> = {
  'hover-start': 'when the pointer enters',
  'hover-end': 'when the pointer leaves',
  'pointer-down': 'on press',
  click: 'on the next click',
  'enters-viewport': 'when it scrolls into view',
  scroll: 'as the page scrolls',
  none: 'on its own',
};

const LABELS: Record<MotionProperty, string> = {
  translateX: 'translateX',
  translateY: 'translateY',
  rotate: 'rotate',
  skew: 'skew',
  scale: 'scale',
  scaleX: 'scaleX',
  scaleY: 'scaleY',
  opacity: 'opacity',
  moveX: 'position x',
  moveY: 'position y',
  width: 'width',
  height: 'height',
};

const UNITS: Record<MotionProperty, string> = {
  translateX: ' px',
  translateY: ' px',
  moveX: ' px',
  moveY: ' px',
  width: ' px',
  height: ' px',
  rotate: '°',
  skew: '°',
  scale: '',
  scaleX: '',
  scaleY: '',
  opacity: '',
};

/** The order phrases appear in: movement first, then size, rotation, and fading. */
const IMPORTANCE: MotionProperty[] = [
  'translateY',
  'translateX',
  'moveY',
  'moveX',
  'scale',
  'scaleX',
  'scaleY',
  'rotate',
  'skew',
  'opacity',
  'width',
  'height',
];

export function triggerPhrase(trigger: UserTrigger): string {
  return WHEN[trigger];
}

const STARTS: Record<Exclude<Mechanism, 'javascript' | 'unknown'>, string> = {
  'css-transition': 'a CSS transition',
  'css-animation': 'a CSS animation',
  'web-animation': 'a Web Animation',
  'scroll-driven-animation': 'a scroll-driven CSS animation',
};

/** For example 'On click, the page adds class "is-on", which starts a CSS transition ("transform").' */
export function describeCause(cause: Cause): string {
  const when = WHEN[cause.trigger];
  const change = cause.classChange;
  const via = change
    ? [
        change.added.length > 0 ? `adds class ${quoteList(change.added)}` : '',
        change.removed.length > 0 ? `removes class ${quoteList(change.removed)}` : '',
      ]
        .filter(Boolean)
        .join(' and ')
    : null;

  if (cause.mechanism === 'javascript') {
    return `${when}, JavaScript animates it by changing its inline style${via ? `, after the page ${via}` : ''}.`;
  }
  if (cause.mechanism === 'unknown') {
    return via ? `${when}, the page ${via}.` : `${when}, it changes in a way that wasn't reported.`;
  }
  const name = cause.animation?.name ? ` ("${cause.animation.name}")` : '';
  const what = `${STARTS[cause.mechanism]}${name}`;
  if (via) return `${when}, the page ${via}, which starts ${what}.`;
  if (cause.trigger === 'hover-start' || cause.trigger === 'hover-end') {
    return `${when}, the browser's :hover state starts ${what}.`;
  }
  return `${when}, ${what} starts.`;
}

function quoteList(tokens: readonly string[]): string {
  return tokens.map((token) => `"${token}"`).join(', ');
}

/** For example "translateY 16 → 0 px, jumps from 0 first". */
export function formatPropertyChange(change: PropertyChange): string {
  const { property, from, to, min, max } = change;
  const unit = UNITS[property];
  let text = `${LABELS[property]} ${value(property, from)} → ${value(property, to)}${unit}`;
  const tolerance = TOLERANCE[property];
  if (max > Math.max(from, to) + tolerance || min < Math.min(from, to) - tolerance) {
    text += ` (reaches ${value(property, min)} to ${value(property, max)}${unit} on the way)`;
  }
  if (change.jumpedFrom !== undefined) text += `, jumps there from ${value(property, change.jumpedFrom)} first`;
  if (change.jumpedTo !== undefined) text += `, then jumps to ${value(property, change.jumpedTo)}`;
  return text;
}

/** A short phrase for one change, e.g. "moves up 8 px" or "fades in (opacity 0 → 1)". */
export function describeChange(change: PropertyChange): string {
  const { property, from, to } = change;
  const delta = to - from;
  // A motion that comes back to where it started is described by how far it went.
  const returned = Math.abs(delta) <= TOLERANCE[property];
  const reach = Math.abs(change.max - from) >= Math.abs(change.min - from) ? change.max - from : change.min - from;
  const amount = returned ? reach : delta;
  const andBack = returned ? ' and back' : '';
  const px = (n: number) => `${value(property, Math.abs(n))} px`;

  switch (property) {
    case 'translateY':
      return `moves ${amount < 0 ? 'up' : 'down'} ${px(amount)}${andBack}`;
    case 'translateX':
      return `moves ${amount < 0 ? 'left' : 'right'} ${px(amount)}${andBack}`;
    case 'moveY':
      return `shifts ${amount < 0 ? 'up' : 'down'} ${px(amount)}${andBack}`;
    case 'moveX':
      return `shifts ${amount < 0 ? 'left' : 'right'} ${px(amount)}${andBack}`;
    case 'scale':
      return returned ? `scales to ${value(property, from + reach)} and back` : fromTo('scales', property, from, to, 1);
    case 'scaleX':
      return `${fromTo('scales', property, from, to, 1)} horizontally`;
    case 'scaleY':
      return `${fromTo('scales', property, from, to, 1)} vertically`;
    case 'rotate':
      return `${fromTo('rotates', property, from, to, 0)}°`;
    case 'skew':
      return `${fromTo('skews', property, from, to, 0)}°`;
    case 'opacity':
      return `fades ${to >= from ? 'in' : 'out'} (opacity ${value(property, from)} → ${value(property, to)})`;
    case 'width':
    case 'height':
      return `changes ${property} from ${value(property, from)} to ${value(property, to)} px`;
  }
}

/** Up to three phrases, most important first: "moves up 8 px and scales to 1.04". */
export function describeChanges(changes: readonly PropertyChange[]): string {
  const sorted = [...changes].sort((a, b) => IMPORTANCE.indexOf(a.property) - IMPORTANCE.indexOf(b.property));
  const phrases = sorted.slice(0, 3).map(describeChange);
  return new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(phrases) || 'changes';
}

/** "300 ms" when observed; "about 290 ms" or "about 1.2 s" when measured. */
export function formatDuration(ms: number, certainty: 'observed' | 'measured'): string {
  const about = certainty === 'measured' ? 'about ' : '';
  // Round before choosing the unit, so 999 ms measured reads "about 1 s", not "about 1000 ms".
  const rounded = certainty === 'measured' ? Math.round(ms / 10) * 10 : ms;
  if (rounded < 1000) return `${about}${formatNumber(rounded, 0)} ms`;
  return `${about}${formatNumber(rounded / 1000, 1)} s`;
}

/** For example "moves up 8.2 px per 100 px scrolled". */
export function describeScrollLink(link: ScrollLink): string {
  return new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(
    link.properties.slice(0, 2).map(describeLinkedProperty),
  );
}

function describeLinkedProperty({ property, perPx }: ScrollLinkedProperty): string {
  const per100 = perPx * 100;
  const amount = value(property, Math.abs(per100));
  const tail = ' per 100 px scrolled';
  switch (property) {
    case 'translateY':
      return `moves ${per100 < 0 ? 'up' : 'down'} ${amount} px${tail}`;
    case 'translateX':
      return `moves ${per100 < 0 ? 'left' : 'right'} ${amount} px${tail}`;
    case 'moveY':
      return `shifts ${per100 < 0 ? 'up' : 'down'} ${amount} px${tail}`;
    case 'moveX':
      return `shifts ${per100 < 0 ? 'left' : 'right'} ${amount} px${tail}`;
    case 'opacity':
      return `fades ${per100 < 0 ? 'out' : 'in'} by ${amount}${tail}`;
    case 'rotate':
      return `rotates ${amount}°${tail}`;
    default:
      return `${per100 < 0 ? 'shrinks' : 'grows'} by ${amount}${tail}`;
  }
}

/** One sentence for the main interaction. */
export function describeHeadline(parts: {
  segments: readonly MotionSegment[];
  scrollLinks: readonly ScrollLink[];
  stagger: Stagger | null;
}): string {
  const mainLink = parts.scrollLinks.find((link) => link.element === 0) ?? parts.scrollLinks[0];
  if (mainLink) return `As the page scrolls, ${mainLink.subject} ${describeScrollLink(mainLink)}.`;

  const motions = parts.segments.filter((segment) => !segment.instant);
  if (parts.stagger) {
    const first = motions.find((segment) => segment.subject === parts.stagger?.subjects[0]);
    const when = first ? WHEN[first.cause.trigger] : 'Over time';
    return `${when}, ${parts.stagger.count} inner elements animate one after another, ${parts.stagger.intervalMs} ms apart.`;
  }

  const main = motions.find((segment) => segment.element === 0) ?? motions[0];
  if (!main) {
    return parts.segments.length > 0
      ? 'Only instant changes happened, with no gradual motion.'
      : 'Nothing moved on its own during the recording.';
  }
  const sentence = `${WHEN[main.cause.trigger]}, ${main.subject} ${describeChanges(main.changes)} over ${formatDuration(
    main.durationMs,
    main.durationCertainty,
  )}.`;
  const back = motions.find((segment) => segment.element === main.element && segment.start > main.end && reverses(main, segment));
  return back ? `${sentence} It returns ${RETURNS[back.cause.trigger]}.` : sentence;
}

/** A later motion undoes an earlier one when its main property ends where the earlier one began. */
function reverses(first: MotionSegment, later: MotionSegment): boolean {
  const main = first.changes[0];
  if (!main) return false;
  const match = later.changes.find((change) => change.property === main.property);
  return match !== undefined && Math.abs(match.to - main.from) <= TOLERANCE[main.property] * 4;
}

function fromTo(verb: string, property: MotionProperty, from: number, to: number, neutral: number): string {
  return Math.abs(from - neutral) <= TOLERANCE[property]
    ? `${verb} to ${value(property, to)}`
    : `${verb} from ${value(property, from)} to ${value(property, to)}`;
}

function value(property: MotionProperty, n: number): string {
  const decimals = property === 'scale' || property === 'scaleX' || property === 'scaleY' ? 3 : property === 'opacity' ? 2 : 1;
  return formatNumber(n, decimals);
}
