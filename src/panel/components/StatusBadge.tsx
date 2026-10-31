export type BadgeTone = 'active' | 'recording' | 'positive' | 'neutral' | 'warning';

const TONES: Record<BadgeTone, { pill: string; dot: string }> = {
  // Matches the blue of the on-page highlight.
  active: {
    pill: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  // Matches the red dot of the on-page recording pill.
  recording: {
    pill: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
    dot: 'bg-red-500',
  },
  positive: {
    pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  neutral: {
    pill: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
    dot: 'bg-neutral-400',
  },
  warning: {
    pill: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
};

export function StatusBadge({ label, tone }: { label: string; tone: BadgeTone }) {
  const styles = TONES[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${styles.pill}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${styles.dot}`} />
      {label}
    </span>
  );
}
