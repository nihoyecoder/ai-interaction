import { formatElementName, formatElementSize, type ElementSummary } from '@/core/element-summary';

export function ElementCard({ element }: { element: ElementSummary }) {
  return (
    <div className="rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
      <p className="font-mono text-sm break-all text-neutral-900 dark:text-neutral-100">{formatElementName(element)}</p>
      <p className="mt-0.5 text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
        {formatElementSize(element)} px
      </p>
    </div>
  );
}
