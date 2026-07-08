/**
 * Minimal typing of a Cypress run result (what `cypress run` produces, e.g. via
 * `--reporter json` or the Module API). Only the fields the pipeline consumes.
 * Cypress structures results very differently from Playwright — a flat list of
 * runs (one per spec), each with its own tests — which is exactly why the
 * scheduler works on plain durations and lets a per-format reader translate.
 */

/** One attempt of a test (Cypress records retries as attempts). */
export interface CypressAttempt {
  duration?: number;
  wallClockDuration?: number;
  state?: string;
}

/** A single test within a spec. */
export interface CypressTest {
  /** Title segments (describe → ... → it) or a single string. */
  title: string[] | string;
  /** Overall outcome: passed | failed | pending | skipped. */
  state?: string;
  /** Test duration in milliseconds (when present). */
  duration?: number;
  attempts?: CypressAttempt[];
}

/** One spec file's run. */
export interface CypressRun {
  spec?: { name?: string; relative?: string };
  tests: CypressTest[];
}

/** The subset of a Cypress run result the pipeline reads. */
export interface CypressReport {
  runs: CypressRun[];
}
