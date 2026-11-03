import type { ReactNode } from 'react';

interface ScreenProps {
  /** Shows a Back link above the title. */
  onBack?: () => void;
  /** Small label above the title, such as the site's hostname. */
  eyebrow?: string;
  title: string;
  notice?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

/** Shared layout for every panel state: optional Back link and notice, then title, body, and actions. */
export function Screen({ onBack, eyebrow, title, notice, actions, children }: ScreenProps) {
  return (
    <section className="flex flex-col gap-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          <span aria-hidden="true">←</span> Back
        </button>
      )}
      {notice}
      <div className="flex flex-col gap-1.5">
        {eyebrow && <p className="truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">{eyebrow}</p>}
        <h2 className="text-base font-semibold">{title}</h2>
        {children && <div className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}
