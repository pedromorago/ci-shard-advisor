const UNIT_MS: Record<string, number> = { ms: 1, s: 1_000, m: 60_000 };

/**
 * Parse a human duration into milliseconds. Accepts a bare number (ms), a
 * value suffixed with ms, s or m, or a compound of unit-suffixed parts — the
 * exact form the advisor's own output prints, so values can be fed back in.
 * Examples: "500", "500ms", "90s", "2m", "9m 30s".
 */
export function parseDuration(input: string): number {
  const parts = input.trim().split(/\s+/);
  if (parts.length === 1) {
    const single = /^(\d+(?:\.\d+)?)(ms|s|m)?$/.exec(parts[0]);
    if (single) return Number(single[1]) * UNIT_MS[single[2] ?? 'ms'];
  } else if (parts.every((part) => /^\d+(?:\.\d+)?(ms|s|m)$/.test(part))) {
    // Compound parts need an explicit unit each ("9m 30s", never "9m 30").
    return parts.reduce((total, part) => {
      const [, value, unit] = /^(\d+(?:\.\d+)?)(ms|s|m)$/.exec(part)!;
      return total + Number(value) * UNIT_MS[unit];
    }, 0);
  }
  throw new Error(`invalid duration '${input}' (use e.g. 500ms, 90s, 2m, 9m 30s)`);
}

/** Parse a positive integer option, throwing a clear error otherwise. */
export function parseIntOption(input: string, name: string): number {
  const value = Number(input);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`--${name} must be a positive integer, got '${input}'`);
  }
  return value;
}
