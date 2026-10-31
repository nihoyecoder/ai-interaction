import type { ReactNode } from 'react';
import {
  describeCause,
  describeEasingFit,
  describeScrollLink,
  formatDuration,
  formatPropertyChange,
} from '@/core/analysis/describe';
import type { EasingFit, InteractionAnalysis, MotionSegment } from '@/core/analysis/types';
import { formatNumber } from '@/core/css-values';
import { overallEasing } from '@/core/recording-evidence';

const MAX_SEGMENTS = 8;

/** What the recording means: the trigger, each motion, and any stagger, with every line labeled. */
export function AnalysisCard({ analysis }: { analysis: InteractionAnalysis }) {
  const { stagger } = analysis;
  // Staggered elements all move the same way, so they're shown once, as a group, instead of one block each.
  const staggered = stagger ? analysis.segments.filter((segment) => stagger.elements.includes(segment.element) && !segment.instant) : [];
  const others = analysis.segments.filter((segment) => !staggered.includes(segment));
  const segments = others.slice(0, MAX_SEGMENTS);
  const hidden = others.length - segments.length;

  return (
    <article className="rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Analysis</h3>
      <p className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">{analysis.headline}</p>

      {analysis.scrollLinks.map((link) => (
        <Block key={`link-${link.element}`} title={`${sentenceSubject(link.subject)} · follows the scroll`}>
          <Line label="Measured">
            {sentenceSubject(link.subject)} {describeScrollLink(link)}.
          </Line>
          {link.mechanism === 'scroll-driven-animation' && link.animation && (
            <Line label="Observed">Driven by a scroll-driven CSS animation ("{link.animation.name}").</Line>
          )}
          {link.mechanism === 'javascript' && (
            <Line label="Estimated">Driven by JavaScript: its inline style changes as you scroll.</Line>
          )}
        </Block>
      ))}

      {stagger && staggered[0] && (
        <SegmentBlock
          segment={staggered[0]}
          title={`${stagger.count} × ${stagger.subjects[0] ?? 'item'} · ${timeRange(staggered[0].start, Math.max(...staggered.map((segment) => segment.end)))}`}
          intro={
            <Line label={stagger.certainty === 'observed' ? 'Observed' : 'Measured'}>
              Staggered: they start {stagger.intervalMs} ms apart, {stagger.order === 'forward' ? 'in page order' : 'last one first'}. Each one:
            </Line>
          }
        />
      )}

      {segments.map((segment, index) => (
        <SegmentBlock key={index} segment={segment} />
      ))}
      {hidden > 0 && <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">…and {hidden} more motions.</p>}

      {analysis.followers > 0 && (
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          {analysis.followers} inner {analysis.followers === 1 ? 'element only moves' : 'elements only move'} along with
          the element around {analysis.followers === 1 ? 'it' : 'them'}.
        </p>
      )}
      {analysis.notes.map((note) => (
        <p key={note} className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {note}
        </p>
      ))}
    </article>
  );
}

function SegmentBlock({ segment, title, intro }: { segment: MotionSegment; title?: string; intro?: ReactNode }) {
  const { animation } = segment.cause;
  const range = segment.instant ? timeRange(segment.start, segment.start) : timeRange(segment.start, segment.end);

  return (
    <Block title={title ?? `${sentenceSubject(segment.subject)} · ${range}`}>
      {intro}
      <Line label="Estimated" note={`${segment.cause.confidence} confidence`}>
        {describeCause(segment.cause)}
      </Line>
      <Line label={segment.durationCertainty === 'observed' ? 'Observed' : 'Measured'}>
        {segment.instant
          ? 'An instant change, not a gradual motion.'
          : `Takes ${formatDuration(segment.durationMs, segment.durationCertainty)}${
              animation ? `, easing ${overallEasing(animation)}` : ''
            }${segment.cutOff ? ' (still running when the recording stopped)' : ''}.`}
      </Line>
      {segment.easing && <EasingLine fit={segment.easing} />}
      {segment.changes.map((change) => (
        <Line key={change.property} label="Measured" mono>
          {formatPropertyChange(change)}
        </Line>
      ))}
    </Block>
  );
}

function EasingLine({ fit }: { fit: EasingFit }) {
  const { summary, detail } = describeEasingFit(fit);
  return (
    <Line label="Estimated">
      {summary}
      {detail && <span className="mt-0.5 block font-mono text-[11px] text-neutral-500 dark:text-neutral-400">{detail}</span>}
    </Line>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-2.5 border-t border-neutral-200 pt-2 dark:border-neutral-800">
      <h4 className="text-xs font-medium text-neutral-900 dark:text-neutral-100">{title}</h4>
      <ul className="mt-1 flex flex-col gap-1">{children}</ul>
    </section>
  );
}

function Line({
  label,
  note,
  mono = false,
  children,
}: {
  label: 'Observed' | 'Measured' | 'Estimated';
  note?: string;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start justify-between gap-3 text-xs">
      <span className={`min-w-0 break-words text-neutral-700 dark:text-neutral-300 ${mono ? 'font-mono' : ''}`}>
        {children}
      </span>
      <span
        title={note}
        className={`flex-none rounded-full px-1.5 py-px text-[10px] font-medium ${
          label === 'Estimated'
            ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
        }`}
      >
        {label}
        {note ? ` · ${note.split(' ')[0]}` : ''}
      </span>
    </li>
  );
}

/** "the element" starts a sentence as "The element"; element names like `li` keep their case. */
function sentenceSubject(subject: string): string {
  return subject === 'the element' ? 'The element' : subject;
}

function timeRange(start: number, end: number): string {
  const from = formatNumber(start / 1000, 2);
  const to = formatNumber(end / 1000, 2);
  return from === to ? `at ${from} s` : `${from}–${to} s`;
}
