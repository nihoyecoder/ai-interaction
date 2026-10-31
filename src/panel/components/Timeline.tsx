import { useMemo, useRef, useState, type FocusEvent, type PointerEvent } from 'react';
import { formatNumber } from '@/core/css-values';
import type { Recording } from '@/core/recording';
import { buildTimeline, type TimelineGroup, type TimelineMark, type TimelineRow } from '@/core/timeline';

/**
 * Categorical slots 1–3 of the reference palette, validated for color-vision
 * deficiency in light and dark mode (dataviz skill). Light-mode green is below
 * 3:1 on white, so every row also has a text label and the list view repeats
 * everything.
 */
const GROUPS: Record<TimelineGroup, { label: string; fill: string; wash: string }> = {
  actions: { label: 'Your actions', fill: 'bg-[#2a78d6] dark:bg-[#3987e5]', wash: 'bg-[#2a78d6]/25 dark:bg-[#3987e5]/30' },
  changes: { label: 'Changes', fill: 'bg-[#eb6834] dark:bg-[#d95926]', wash: 'bg-[#eb6834]/25 dark:bg-[#d95926]/30' },
  evidence: { label: 'Evidence', fill: 'bg-[#1baf7a] dark:bg-[#199e70]', wash: 'bg-[#1baf7a]/25 dark:bg-[#199e70]/30' },
};
const GROUP_ORDER: TimelineGroup[] = ['actions', 'changes', 'evidence'];
const TOOLTIP_HALF_WIDTH = 110;

interface ActiveMark {
  row: TimelineRow;
  mark: TimelineMark;
  left: number;
  top: number;
}

/** A 0 to 10 s timeline of what you did, what changed, and the evidence, with details on hover or focus. */
export function Timeline({ recording }: { recording: Recording }) {
  const timeline = useMemo(() => buildTimeline(recording), [recording]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<ActiveMark | null>(null);

  if (timeline.rows.length === 0) return null;

  const span = Math.max(timeline.durationMs, 1000);
  const position = (t: number) => `${(Math.min(Math.max(t, 0), span) / span) * 100}%`;
  const tickStep = span <= 5000 ? 1000 : 2000;
  const ticks = Array.from({ length: Math.floor(span / tickStep) + 1 }, (_, index) => index * tickStep);
  const groups = GROUP_ORDER.filter((group) => timeline.rows.some((row) => row.group === group));

  const show = (row: TimelineRow, mark: TimelineMark) => (event: PointerEvent | FocusEvent) => {
    const container = containerRef.current?.getBoundingClientRect();
    const target = event.currentTarget.getBoundingClientRect();
    if (!container) return;
    const center = target.left + target.width / 2 - container.left;
    const left =
      container.width > TOOLTIP_HALF_WIDTH * 2
        ? Math.min(Math.max(center, TOOLTIP_HALF_WIDTH), container.width - TOOLTIP_HALF_WIDTH)
        : container.width / 2;
    setActive({ row, mark, left, top: target.top - container.top });
  };
  const hide = () => setActive(null);

  return (
    <figure className="mt-3" aria-label="Recording timeline">
      <ul className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-600 dark:text-neutral-400">
        {groups.map((group) => (
          <li key={group} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-2 w-3 rounded-full ${GROUPS[group].fill}`} />
            {GROUPS[group].label}
          </li>
        ))}
      </ul>

      <div ref={containerRef} className="relative" onPointerLeave={hide}>
        {timeline.rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
            <span title={row.label} className="truncate text-[11px] text-neutral-600 dark:text-neutral-400">
              {row.label}
            </span>
            <div className="relative h-6">
              <Gridlines ticks={ticks} position={position} />
              {row.marks.map((mark, index) => (
                <Mark
                  key={index}
                  row={row}
                  mark={mark}
                  position={position}
                  span={span}
                  onShow={show(row, mark)}
                  onHide={hide}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2" aria-hidden="true">
          <span />
          <div className="relative h-4 text-[10px] text-neutral-500 tabular-nums dark:text-neutral-400">
            {ticks.map((tick, index) => (
              <span
                key={tick}
                className={`absolute top-0.5 ${index === 0 ? '' : index === ticks.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`}
                style={{ left: position(tick) }}
              >
                {tick / 1000} s
              </span>
            ))}
          </div>
        </div>

        {active && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 -translate-y-full rounded-md bg-neutral-900 px-2 py-1.5 text-[11px] leading-snug text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
            style={{ left: active.left, top: active.top - 4 }}
          >
            <p className="font-semibold">{markTime(active.mark)}</p>
            <p className="mt-0.5 text-neutral-300 dark:text-neutral-600">{active.mark.description}</p>
          </div>
        )}
      </div>

      {(timeline.hiddenInnerRows > 0 || timeline.hiddenAnimationRows > 0) && (
        <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
          Not shown:{' '}
          {[
            timeline.hiddenInnerRows > 0 ? `${timeline.hiddenInnerRows} more inner elements` : '',
            timeline.hiddenAnimationRows > 0 ? `${timeline.hiddenAnimationRows} more animations (see Evidence)` : '',
          ]
            .filter(Boolean)
            .join(', ')}
          .
        </p>
      )}

      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-neutral-600 dark:text-neutral-400">Timeline as a list</summary>
        <ul className="mt-1.5 flex flex-col gap-1 text-neutral-700 dark:text-neutral-300">
          {timeline.rows.flatMap((row) =>
            row.marks.map((mark, index) => (
              <li key={`${row.id}-${index}`}>
                <span className="font-medium">{row.label}:</span> {mark.description}
              </li>
            )),
          )}
        </ul>
      </details>
    </figure>
  );
}

function Gridlines({ ticks, position }: { ticks: number[]; position: (t: number) => string }) {
  return (
    <>
      {ticks.map((tick) => (
        <span
          key={tick}
          aria-hidden="true"
          className="absolute inset-y-0 w-px bg-neutral-200 dark:bg-neutral-800"
          style={{ left: position(tick) }}
        />
      ))}
    </>
  );
}

interface MarkProps {
  row: TimelineRow;
  mark: TimelineMark;
  position: (t: number) => string;
  span: number;
  onShow: (event: PointerEvent | FocusEvent) => void;
  onHide: () => void;
}

function Mark({ row, mark, position, span, onShow, onHide }: MarkProps) {
  const { fill, wash } = GROUPS[row.group];
  const common = {
    type: 'button' as const,
    'aria-label': `${row.label}: ${mark.description}`,
    onPointerEnter: onShow,
    onFocus: onShow,
    onBlur: onHide,
  };
  const focusRing = 'rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500';

  if (mark.shape === 'point') {
    // A 24 px hit area around an 8 px dot, so it's easy to hover.
    return (
      <button
        {...common}
        className={`group absolute top-0 flex h-6 w-6 -translate-x-1/2 items-center justify-center ${focusRing}`}
        style={{ left: position(mark.start) }}
      >
        <span
          className={`size-2 rounded-full ring-2 ring-white group-hover:scale-125 motion-reduce:transform-none dark:ring-neutral-950 ${fill}`}
        />
      </button>
    );
  }

  const width = `max(${((Math.max(mark.end - mark.start, 0) / span) * 100).toFixed(3)}%, 6px)`;
  const delayShare =
    mark.activeFrom !== undefined && mark.end > mark.start ? ((mark.activeFrom - mark.start) / (mark.end - mark.start)) * 100 : 0;

  return (
    <button
      {...common}
      className={`group absolute top-0 flex h-6 items-center ${focusRing}`}
      style={{ left: position(mark.start), width }}
    >
      {mark.shape === 'ongoing' ? (
        <>
          <span className={`absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 ${fill}`} />
          <span className={`absolute left-0 size-2 rounded-full ring-2 ring-white dark:ring-neutral-950 ${fill}`} />
        </>
      ) : (
        <span className="flex h-2 w-full overflow-hidden rounded-full group-hover:brightness-110">
          {delayShare > 0 && <span className={`h-full ${wash}`} style={{ width: `${delayShare}%` }} />}
          <span className={`h-full flex-1 ${fill}`} />
        </span>
      )}
    </button>
  );
}

function markTime(mark: TimelineMark): string {
  const from = formatNumber(mark.start / 1000, 2);
  if (mark.shape === 'point') return `${from} s`;
  if (mark.shape === 'ongoing') return `From ${from} s, still running`;
  const to = formatNumber(mark.end / 1000, 2);
  return from === to ? `${from} s` : `${from}–${to} s`;
}
