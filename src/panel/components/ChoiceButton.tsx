import type { ComponentProps, ReactNode } from 'react';

type ChoiceButtonProps = ComponentProps<'button'> & {
  icon: ReactNode;
  title: string;
  description: string;
  /** A short label next to the title, such as "Coming soon". */
  tag?: string;
};

/** A large, full-width choice with an icon, a title, and one line of explanation. */
export function ChoiceButton({ icon, title, description, tag, className = '', ...props }: ChoiceButtonProps) {
  return (
    <button
      type="button"
      className={`flex w-full items-start gap-3 rounded-xl border border-neutral-200 p-3 text-left transition-colors hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none dark:border-neutral-800 dark:hover:border-neutral-700 dark:hover:bg-neutral-900 ${className}`}
      {...props}
    >
      <span className="flex size-9 flex-none items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {title}
          {tag && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {tag}
            </span>
          )}
        </span>
        <span className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{description}</span>
      </span>
    </button>
  );
}
