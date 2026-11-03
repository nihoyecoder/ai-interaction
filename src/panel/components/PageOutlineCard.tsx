import { formatElementName, formatElementSize } from '@/core/element-summary';
import type { PageSelection } from '@/core/selection';

/** Full page: the page's size and the sections found in it, from the top. */
export function PageOutlineCard({ selection }: { selection: PageSelection }) {
  const { sections } = selection;
  return (
    <article className="rounded-lg border border-neutral-200 dark:border-neutral-800">
      <header className="flex items-baseline justify-between gap-3 border-b border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
        <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {sections.length === 1 ? '1 section' : `${sections.length} sections`}
        </h3>
        <p className="text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
          Page {formatElementSize(selection.page)} px
        </p>
      </header>
      {sections.length > 0 ? (
        <ol className="divide-y divide-neutral-100 dark:divide-neutral-900">
          {sections.map((section, index) => (
            <li key={index} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-4 flex-none text-right text-neutral-400 tabular-nums dark:text-neutral-500">
                  {index + 1}
                </span>
                <span className="truncate font-mono text-neutral-900 dark:text-neutral-100">
                  {formatElementName(section.element)}
                </span>
                {section.placement !== 'flow' && (
                  <span className="flex-none rounded-full bg-neutral-100 px-1.5 py-px text-[11px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                    {section.placement}
                  </span>
                )}
              </span>
              <span className="flex-none text-neutral-500 tabular-nums dark:text-neutral-400">
                {section.element.height.toLocaleString()} px
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-3 py-2.5 text-xs text-neutral-500 dark:text-neutral-400">
          No sections found. This page might draw everything in one block, such as a canvas.
        </p>
      )}
    </article>
  );
}
