import type { ReactNode } from 'react';

interface ScreenProps {
  /** Small label above the title, such as the site's hostname. */
  eyebrow?: string;
  title: string;
  notice?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

/** Shared layout for every panel state: optional notice, then title, body, and actions. */
export function Screen({ eyebrow, title, notice, actions, children }: ScreenProps) {
  return (
    <section className="flex flex-col gap-4">
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
