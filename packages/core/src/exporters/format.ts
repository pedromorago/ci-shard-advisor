/**
 * Format a millisecond duration for humans, deterministically (no locale, no
 * clock): sub-minute values as seconds with one decimal, longer ones as
 * "Nm Ns". Snapshot-stable across machines.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    const seconds = totalSeconds.toFixed(1);
    // 59.96s would render as "60.0s" — carry it into the minute form instead.
    if (seconds !== '60.0') return `${seconds}s`;
  }
  // Round to whole seconds BEFORE splitting so 119.6s is "2m 0s", never "1m 60s".
  const rounded = Math.round(totalSeconds);
  return `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
}

/** Format a signed delta with an explicit + or - sign (for savings lines). */
export function formatSignedDuration(ms: number): string {
  const sign = ms < 0 ? '-' : '+';
  return `${sign}${formatDuration(Math.abs(ms))}`;
}

/**
 * Billed machine time as money at the given rate, or null when there is no
 * (positive) price — callers fall back to machine time. The single home of
 * the ms→currency conversion (spec §4): every adapter shows the same number.
 */
export function formatMoney(costMs: number, pricePerMinute?: number, currency = '€'): string | null {
  if (!pricePerMinute) return null;
  return `${currency}${((costMs / 60_000) * pricePerMinute).toFixed(2)}`;
}

/** Signed duration delta; 0 → ±0, negative (faster/cheaper) shows a minus. */
export function signedDuration(ms: number): string {
  if (ms === 0) return '±0';
  return `${ms < 0 ? '−' : '+'}${formatDuration(Math.abs(ms))}`;
}

/** Signed money delta at the given rate, or null when there is no price. */
export function signedMoney(ms: number, pricePerMinute?: number, currency = '€'): string | null {
  if (!pricePerMinute) return null;
  if (ms === 0) return '±0';
  return `${ms < 0 ? '−' : '+'}${formatMoney(Math.abs(ms), pricePerMinute, currency)}`;
}
