import { formatNumber } from './css-values';
import { formatElementName } from './element-summary';
import type { AnimationRecord, ClassChange, Recording } from './recording';
import { formatAnimationRecord } from './recording-evidence';
import { changeTimesByElement } from './recording-summary';

export type TimelineGroup = 'actions' | 'changes' | 'evidence';

export interface TimelineMark {
  /** span: from start to end. point: one moment. ongoing: running from `start` to the end of the recording. */
  shape: 'span' | 'point' | 'ongoing';
  start: number;
  end: number;
  /** For animations with a delay: the part from `start` to `activeFrom` is the delay. */
  activeFrom?: number;
  /** One sentence, shown on hover and in the list view. */
  description: string;
}

export interface TimelineRow {
  id: string;
  label: string;
  group: TimelineGroup;
  marks: TimelineMark[];
}

export interface Timeline {
  durationMs: number;
  rows: TimelineRow[];
  /** Rows left out to keep the timeline short. Their details stay in the summary and evidence. */
  hiddenInnerRows: number;
  hiddenAnimationRows: number;
}

const MAX_INNER_ROWS = 5;
const MAX_ANIMATION_ROWS = 6;
/** Changes closer together than this form one span (about 6 frames at 60 fps). */
const CHANGE_GAP_MS = 100;
const SCROLL_GAP_MS = 250;

/** Turns a recording into timeline rows: your actions, what changed, and the evidence for why. */
export function buildTimeline(recording: Recording): Timeline {
  const end = recording.durationMs;
  const rows: TimelineRow[] = [];
  const add = (row: TimelineRow) => {
    if (row.marks.length > 0) rows.push(row);
  };

  add({
    id: 'hover',
    label: 'Hover',
    group: 'actions',
    marks: hoverSpans(recording).map((span) => ({
      shape: 'span',
      ...span,
      description: `Pointer on the element ${range(span.start, span.end)}`,
    })),
  });
  add({
    id: 'clicks',
    label: 'Clicks',
    group: 'actions',
    marks: recording.presses
      .filter((press) => press.type === 'press')
      .map((press) => ({
        shape: 'point',
        start: press.t,
        end: press.t,
        description: `Pressed ${press.onElement ? 'on the element' : 'elsewhere on the page'} at ${seconds(press.t)}`,
      })),
  });
  add({
    id: 'scroll',
    label: 'Scroll',
    group: 'actions',
    marks: groupIntoSpans(scrollTimes(recording), SCROLL_GAP_MS).map((span) => ({
      shape: 'span',
      ...span,
      description: `Scrolling ${range(span.start, span.end)}`,
    })),
  });

  const changeTimes = changeTimesByElement(recording);
  add({
    id: 'element',
    label: 'Element',
    group: 'changes',
    marks: groupIntoSpans(changeTimes[0] ?? [], CHANGE_GAP_MS).map((span) => ({
      shape: 'span',
      ...span,
      description: `The element changed ${range(span.start, span.end)}`,
    })),
  });
  const changedInner = recording.elements
    .map((element, index) => ({ name: formatElementName(element.name), index, times: changeTimes[index] ?? [] }))
    .filter(({ index, times }) => index > 0 && times.length > 0);
  for (const { name, index, times } of changedInner.slice(0, MAX_INNER_ROWS)) {
    add({
      id: `inner-${index}`,
      label: name,
      group: 'changes',
      marks: groupIntoSpans(times, CHANGE_GAP_MS).map((span) => ({
        shape: 'span',
        ...span,
        description: `${name} changed ${range(span.start, span.end)}`,
      })),
    });
  }

  add({
    id: 'classes',
    label: 'Classes',
    group: 'evidence',
    marks: recording.classChanges.map((change) => ({
      shape: 'point',
      start: change.t,
      end: change.t,
      description: describeClassChange(change),
    })),
  });
  recording.animations.slice(0, MAX_ANIMATION_ROWS).forEach((animation, index) => {
    add({ id: `animation-${index}`, label: animationLabel(animation), group: 'evidence', marks: [animationMark(animation, end)] });
  });

  return {
    durationMs: end,
    rows,
    hiddenInnerRows: Math.max(0, changedInner.length - MAX_INNER_ROWS),
    hiddenAnimationRows: Math.max(0, recording.animations.length - MAX_ANIMATION_ROWS),
  };
}

/** Times close together become one span; a lone time becomes a span of zero length. */
export function groupIntoSpans(times: readonly number[], maxGap: number): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  for (const t of times) {
    const last = spans[spans.length - 1];
    if (last && t - last.end <= maxGap) last.end = t;
    else spans.push({ start: t, end: t });
  }
  return spans;
}

function hoverSpans(recording: Recording): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  let since: number | null = recording.startHovered ? 0 : null;
  for (const change of recording.hover) {
    if (change.hovered && since === null) since = change.t;
    if (!change.hovered && since !== null) {
      spans.push({ start: since, end: change.t });
      since = null;
    }
  }
  if (since !== null) spans.push({ start: since, end: recording.durationMs });
  return spans;
}

/** Times something scrolled. The page's first sample is its starting position, not a scroll. */
function scrollTimes(recording: Recording): number[] {
  let sawPageStart = false;
  const times: number[] = [];
  for (const sample of recording.scroll) {
    if (sample.area === -1 && !sawPageStart) {
      sawPageStart = true;
      continue;
    }
    times.push(sample.t);
  }
  return times.sort((a, b) => a - b);
}

function animationMark(animation: AnimationRecord, end: number): TimelineMark {
  const description = formatAnimationRecord(animation);
  const { durationMs, iterations } = animation;
  // Without a known start, duration, or repeat count, the animation is shown as running to the end.
  if (durationMs === null || iterations === null || animation.runningAtStart || animation.scrollDriven) {
    return { shape: 'ongoing', start: animation.t, end, description };
  }
  const activeFrom = Math.min(end, animation.t + Math.max(0, animation.delayMs));
  const stop = Math.min(end, activeFrom + durationMs * iterations);
  return {
    shape: 'span',
    start: animation.t,
    end: stop,
    ...(activeFrom > animation.t ? { activeFrom } : {}),
    description,
  };
}

function animationLabel(animation: AnimationRecord): string {
  const name = animation.name || 'animation';
  return animation.element === 0 ? name : `${name} · ${formatElementName(animation.target)}`;
}

function describeClassChange(change: ClassChange): string {
  const parts = [
    ...(change.added.length > 0 ? [`added ${quote(change.added)}`] : []),
    ...(change.removed.length > 0 ? [`removed ${quote(change.removed)}`] : []),
  ];
  const where = change.element === 0 ? '' : ` on ${formatElementName(change.target)}`;
  return `Class ${parts.join(', ')} at ${seconds(change.t)}${where}`;
}

function quote(tokens: readonly string[]): string {
  return tokens.map((token) => `"${token}"`).join(', ');
}

function range(start: number, end: number): string {
  const from = formatNumber(start / 1000, 1);
  const to = formatNumber(end / 1000, 1);
  return from === to ? `at ${from} s` : `from ${from} to ${to} s`;
}

function seconds(ms: number): string {
  return `${formatNumber(ms / 1000, 1)} s`;
}
