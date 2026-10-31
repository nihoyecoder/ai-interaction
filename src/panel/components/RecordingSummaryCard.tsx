import { useMemo } from 'react';
import { formatNumber } from '@/core/css-values';
import type { Recording, StopReason } from '@/core/recording';
import { describeEvidence } from '@/core/recording-evidence';
import { summarizeRecording, type RecordingSummary } from '@/core/recording-summary';

const STOP_NOTES: Partial<Record<StopReason, string>> = {
  'time-limit': 'Stopped at the 10-second limit.',
  'tab-hidden': 'Stopped because you left the tab.',
  'nothing-selected': 'Nothing was recorded, because no element was selected.',
};

const listFormat = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

/** What a finished recording measured, in plain sentences. */
export function RecordingSummaryCard({ recording }: { recording: Recording }) {
  const summary = useMemo(() => summarizeRecording(recording), [recording]);
  const evidence = useMemo(() => describeEvidence(recording), [recording]);
  const stopNote = STOP_NOTES[summary.stopReason];

  return (
    <article className="rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Recording</h3>
        <span
          title="Measured from the page while recording"
          className="flex-none rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
        >
          Measured
        </span>
      </header>
      <p className="mt-1 text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
        {seconds(summary.durationMs)} recorded · {summary.frameCount.toLocaleString()} frames
      </p>
      {summary.stopReason !== 'nothing-selected' && (
        <ul className="mt-2 flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
          <li>{describeElementChange(summary)}</li>
          {summary.trackedDescendants > 0 && (
            <li>
              {summary.changedDescendants} of {summary.trackedDescendants} tracked inner elements changed.
            </li>
          )}
          <li>{describeActions(summary)}</li>
        </ul>
      )}
      {summary.stopReason !== 'nothing-selected' && (
        <section className="mt-3 border-t border-neutral-200 pt-2.5 dark:border-neutral-800">
          <h4 className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
            Evidence
          </h4>
          {evidence.length > 0 ? (
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {evidence.map((line, index) => (
                <li key={index} className="flex items-start justify-between gap-3 text-xs">
                  <span className="min-w-0 break-words text-neutral-700 dark:text-neutral-300">{line.text}</span>
                  <span
                    className={`flex-none rounded-full px-1.5 py-px text-[10px] font-medium ${
                      line.label === 'Estimated'
                        ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                    }`}
                  >
                    {line.label}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              No CSS animations, class changes, or inline-style changes were seen.
            </p>
          )}
        </section>
      )}
      {stopNote && <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{stopNote}</p>}
    </article>
  );
}

function describeElementChange({ elementChange }: RecordingSummary): string {
  if (!elementChange) return "The element didn't change on its own.";
  if (elementChange.from === elementChange.to) return `The element changed at ${seconds(elementChange.from)}.`;
  return `The element changed between ${seconds(elementChange.from)} and ${seconds(elementChange.to)}.`;
}

function describeActions({ pageScrollPx, scrolledAreas, clicks, hoverEnters }: RecordingSummary): string {
  const actions: string[] = [];
  if (pageScrollPx > 0) actions.push(`scrolled the page ${pageScrollPx.toLocaleString()} px`);
  if (scrolledAreas > 0) actions.push(`scrolled ${scrolledAreas} other ${scrolledAreas === 1 ? 'area' : 'areas'}`);
  if (clicks > 0) actions.push(`clicked ${clicks}×`);
  if (hoverEnters > 0) actions.push(`hovered the element ${hoverEnters}×`);
  return actions.length > 0 ? `You ${listFormat.format(actions)}.` : "You didn't scroll, click, or hover the element.";
}

function seconds(ms: number): string {
  return `${formatNumber(ms / 1000, 1)} s`;
}
