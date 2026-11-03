import { formatElementName, formatElementPath, formatElementSize } from '@/core/element-summary';
import type { ElementSelection } from '@/core/selection';
import { Button } from './Button';

interface SelectionCardProps {
  selection: ElementSelection;
  onWider: () => void;
  onNarrower: () => void;
}

/** The selected element or section: its name, size, and place on the page, with Wider and Narrower to adjust it. */
export function SelectionCard({ selection, onWider, onNarrower }: SelectionCardProps) {
  const { element, path } = selection;
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-mono text-sm break-all text-neutral-900 dark:text-neutral-100">
          {formatElementName(element)}
        </p>
        <p className="flex-none text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
          {formatElementSize(element)} px
        </p>
      </div>
      {path.length > 0 && (
        <p className="truncate text-xs text-neutral-500 dark:text-neutral-400" title={formatElementPath(path, path.length)}>
          in {formatElementPath(path)}
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={!selection.canWiden} onClick={onWider}>
          <span aria-hidden="true">↑</span> Wider
        </Button>
        <Button size="sm" variant="secondary" disabled={!selection.canNarrow} onClick={onNarrower}>
          <span aria-hidden="true">↓</span> Narrower
        </Button>
      </div>
    </article>
  );
}
