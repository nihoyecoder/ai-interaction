import { formatNumber } from './css-values';
import { formatElementName, type ElementName } from './element-summary';
import type { AnimationRecord, Recording } from './recording';

export interface EvidenceLine {
  text: string;
  /** Observed: read directly from the browser. Estimated: inferred from what was observed. */
  label: 'Observed' | 'Estimated';
}

/** How many lines of one kind to show before summarizing the rest. */
const MAX_LINES_PER_KIND = 6;
/** This many inline-style changes or more usually means JavaScript is animating the element. */
const SCRIPTED_STYLE_WRITES = 10;

const KIND_LABELS: Record<AnimationRecord['kind'], string> = {
  'css-transition': 'CSS transition',
  'css-animation': 'CSS animation',
  'web-animation': 'Web Animation',
};

/**
 * What caused the motion, as plain sentences: class and attribute changes
 * (common triggers), the animations Chrome ran, and inline-style changes
 * (the trace JavaScript animation libraries leave).
 */
export function describeEvidence(recording: Recording): EvidenceLine[] {
  const lines: EvidenceLine[] = [];

  addCapped(
    lines,
    recording.classChanges.flatMap((change) => {
      const where = `at ${seconds(change.t)}${on(change)}`;
      return [
        ...(change.added.length > 0 ? [`Class ${quoteList(change.added)} added ${where}`] : []),
        ...(change.removed.length > 0 ? [`Class ${quoteList(change.removed)} removed ${where}`] : []),
      ];
    }),
    'class changes',
  );

  const attributeGroups = new Map<string, { name: string; count: number; first: number; ref: ElementRef }>();
  for (const change of recording.attributeChanges) {
    const key = `${change.element}|${formatElementName(change.target)}|${change.name}`;
    const group = attributeGroups.get(key);
    if (group) group.count++;
    else attributeGroups.set(key, { name: change.name, count: 1, first: change.t, ref: change });
  }
  addCapped(
    lines,
    [...attributeGroups.values()].map(
      (group) =>
        `Attribute "${group.name}" changed${group.count > 1 ? ` ${group.count}×` : ''}, first at ${seconds(group.first)}${on(group.ref)}`,
    ),
    'attribute changes',
  );

  addCapped(lines, recording.animations.map(formatAnimationRecord), 'animations');

  const writes = recording.styleWrites.filter((entry) => entry.count > 0);
  if (writes.length > 0) {
    const total = writes.reduce((sum, entry) => sum + entry.count, 0);
    const elements = `${writes.length} ${writes.length === 1 ? 'element' : 'elements'}`;
    lines.push(
      total >= SCRIPTED_STYLE_WRITES
        ? {
            text: `Inline styles changed ${total} times on ${elements}, which usually means JavaScript is animating ${writes.length === 1 ? 'it' : 'them'}.`,
            label: 'Estimated',
          }
        : { text: `Inline styles changed ${total}× on ${elements}`, label: 'Observed' },
    );
  }

  return lines;
}

/** For example "CSS transition: transform · 300 ms · ease-out · started at 1.2 s". */
export function formatAnimationRecord(record: AnimationRecord): string {
  const parts = [`${KIND_LABELS[record.kind]}: ${record.name || 'unnamed'}`];
  parts.push(record.durationMs === null ? 'auto' : milliseconds(record.durationMs));
  parts.push(overallEasing(record));
  if (record.delayMs) parts.push(`delay ${milliseconds(record.delayMs)}`);
  if (record.iterations === null) parts.push('repeats forever');
  else if (record.iterations !== 1) parts.push(`${formatNumber(record.iterations, 2)}×`);
  if (record.direction !== 'normal') parts.push(record.direction);
  if (record.scrollDriven) parts.push('scroll-driven');
  parts.push(record.runningAtStart ? 'already running' : `started at ${seconds(record.t)}`);
  return `${parts.join(' · ')}${on(record)}`;
}

/**
 * CSS animations apply their timing function per keyframe, so the effect itself
 * reports "linear". In that case the first keyframe's easing is the meaningful one.
 */
export function overallEasing(record: AnimationRecord): string {
  if (record.easing !== 'linear') return record.easing;
  return record.keyframes.find((keyframe) => keyframe.easing !== 'linear')?.easing ?? 'linear';
}

type ElementRef = { element: number; target: ElementName; pseudo?: string | null };

/** " on li.item" for anything other than the selected element itself. */
function on(ref: ElementRef): string {
  if (ref.element === 0 && !ref.pseudo) return '';
  const name = ref.element === 0 ? 'the element' : formatElementName(ref.target);
  return ` on ${name}${ref.pseudo ?? ''}`;
}

function addCapped(lines: EvidenceLine[], texts: string[], noun: string): void {
  for (const text of texts.slice(0, MAX_LINES_PER_KIND)) lines.push({ text, label: 'Observed' });
  const hidden = texts.length - MAX_LINES_PER_KIND;
  if (hidden > 0) lines.push({ text: `…and ${hidden} more ${noun}`, label: 'Observed' });
}

function quoteList(tokens: readonly string[]): string {
  return tokens.map((token) => `"${token}"`).join(', ');
}

function seconds(ms: number): string {
  return `${formatNumber(ms / 1000, 1)} s`;
}

function milliseconds(ms: number): string {
  return Math.abs(ms) < 1000 ? `${formatNumber(ms, 0)} ms` : `${formatNumber(ms / 1000, 2)} s`;
}
