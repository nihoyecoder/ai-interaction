/** Small helpers for reading the values Chrome returns from getComputedStyle. */

/**
 * Splits a comma-separated CSS list, ignoring commas inside parentheses:
 * "opacity, cubic-bezier(0.2, 0, 0, 1)" → ["opacity", "cubic-bezier(0.2, 0, 0, 1)"].
 */
export function splitCssList(value: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === '(') depth++;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (char === ',' && depth === 0) {
      items.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  items.push(value.slice(start).trim());
  return items.filter((item) => item !== '');
}

/** A CSS time such as "0.3s" or "300ms", in milliseconds. Null if it isn't a time, e.g. "auto". */
export function parseTimeMs(value: string): number | null {
  const match = /^(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(ms|s)$/i.exec(value.trim());
  if (!match?.[1] || !match[2]) return null;
  const amount = Number(match[1]);
  return match[2].toLowerCase() === 's' ? amount * 1000 : amount;
}

/** "300 ms" below one second, "1.5 s" from one second up. Values that aren't times are returned as they are. */
export function formatTime(value: string): string {
  const ms = parseTimeMs(value);
  if (ms === null) return value;
  return Math.abs(ms) < 1000 ? `${formatNumber(ms, 0)} ms` : `${formatNumber(ms / 1000, 2)} s`;
}

/** Rounds to a few decimals and drops trailing zeros: 0.8200001 → "0.82". */
export function formatNumber(value: number, decimals: number): string {
  const rounded = Number(value.toFixed(decimals));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}
