import { formatNumber } from '@/core/css-values';
import { MAX_RECORDING_MS } from '@/core/recording';
import { useElapsed } from '../hooks/useElapsed';

/** Seconds recorded so far, out of the 10-second limit. */
export function RecordingTimer({ startedAt }: { startedAt: number }) {
  const elapsed = Math.min(useElapsed(startedAt), MAX_RECORDING_MS);
  return (
    <p className="font-mono text-2xl text-neutral-900 tabular-nums dark:text-neutral-100">
      {formatNumber(elapsed / 1000, 1)} s
      <span className="ml-1 text-sm text-neutral-500 dark:text-neutral-400">/ {MAX_RECORDING_MS / 1000} s</span>
    </p>
  );
}
