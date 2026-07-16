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
