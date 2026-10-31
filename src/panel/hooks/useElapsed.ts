import { useEffect, useState } from 'react';

/** Milliseconds since `startedAt` (a Date.now() time), updated ten times a second. */
export function useElapsed(startedAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, now - startedAt);
}
