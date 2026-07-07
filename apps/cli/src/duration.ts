/**
 * Parse a human duration into milliseconds. Accepts a bare number (ms) or a
 * value suffixed with ms, s or m. Examples: "500", "500ms", "90s", "2m".
 */
export function parseDuration(input: string): number {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m)?$/.exec(input.trim());
  if (!match) {
    throw new Error(`invalid duration '${input}' (use e.g. 500ms, 90s, 2m)`);
  }
  const value = Number(match[1]);
  switch (match[2]) {
    case 'm':
      return value * 60_000;
    case 's':
      return value * 1_000;
    default:
      return value;
  }
}

/** Parse a positive integer option, throwing a clear error otherwise. */
export function parseIntOption(input: string, name: string): number {
  const value = Number(input);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`--${name} must be a positive integer, got '${input}'`);
  }
  return value;
}
