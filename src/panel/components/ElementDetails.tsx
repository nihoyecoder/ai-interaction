import { Fragment, useMemo } from 'react';
import type { ElementSnapshot } from '@/core/element-snapshot';
import { formatElementName, formatElementPath, formatElementSize } from '@/core/element-summary';
import { describeStyles, type StyleRow } from '@/core/style-groups';
import { readDefaultStyles } from '../default-styles';
import { Button } from './Button';

interface ElementDetailsProps {
  snapshot: ElementSnapshot;
  onSelectParent: () => void;
  onSelectChild: () => void;
}

/** The selected element's details: where it is, its size, and the styles that matter for motion. */
export function ElementDetails({ snapshot, onSelectParent, onSelectChild }: ElementDetailsProps) {
  const groups = useMemo(() => describeStyles(snapshot, readDefaultStyles(snapshot)), [snapshot]);
  const { element, layoutSize, position, path } = snapshot;
  const size = layoutSize ?? element;
  const looksDifferentOnScreen =
    layoutSize !== null &&
    (Math.abs(layoutSize.width - element.width) > 1 || Math.abs(layoutSize.height - element.height) > 1);

  const placement: StyleRow[] = [
    { label: 'Size', value: `${formatElementSize(size)} px` },
    ...(looksDifferentOnScreen ? [{ label: 'On screen', value: `${formatElementSize(element)} px` }] : []),
    { label: 'Page position', value: `x ${position.x.toLocaleString()}, y ${position.y.toLocaleString()}` },
  ];

  return (
    <article className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      <header className="flex flex-col gap-2 border-b border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 font-mono text-sm break-all text-neutral-900 dark:text-neutral-100">
            {formatElementName(element)}
          </p>
          <span
            title="Read directly from the browser"
            className="flex-none rounded-full border border-neutral-300 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
          >
            Observed
          </span>
        </div>
        {path.length > 0 && (
          <p
            className="truncate text-xs text-neutral-500 dark:text-neutral-400"
            title={formatElementPath(path, path.length)}
          >
            in {formatElementPath(path)}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!snapshot.canSelectParent}
            onClick={onSelectParent}
            aria-label="Select parent element"
          >
            <span aria-hidden="true">↑</span> Parent
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!snapshot.canSelectChild}
            onClick={onSelectChild}
            aria-label="Select child element"
          >
            <span aria-hidden="true">↓</span> Child
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-4 px-3 py-3">
        <DetailList rows={placement} />
        {snapshot.hovered && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Read while your pointer was on it. If it has hover effects, they're included.
          </p>
        )}
        {groups.length > 0 ? (
          groups.map((group) => (
            <section key={group.title} className="flex flex-col gap-1.5">
              <h3 className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
                {group.title}
              </h3>
              <DetailList rows={group.rows} />
            </section>
          ))
        ) : (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No styles differ from the browser defaults.</p>
        )}
      </div>
    </article>
  );
}

function DetailList({ rows }: { rows: StyleRow[] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
      {rows.map((row, index) => (
        <Fragment key={`${row.label}-${index}`}>
          <dt className="text-neutral-500 dark:text-neutral-400">{row.label}</dt>
          <dd className="font-mono break-words text-neutral-900 dark:text-neutral-100">
            {row.value}
            {row.note && (
              <span className="mt-0.5 block text-[11px] break-all text-neutral-500 dark:text-neutral-400">
                {row.note}
              </span>
            )}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}
