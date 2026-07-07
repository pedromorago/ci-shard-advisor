/**
 * Minimal typing of Playwright's JSON reporter output — only the fields the
 * pipeline actually consumes. Real reports carry much more (config, stats,
 * annotations, attachments); we intentionally ignore the rest so the parser
 * tolerates version differences.
 */

/** Outcome Playwright assigns to a whole test across its retries. */
export type ReportTestStatus = 'skipped' | 'expected' | 'unexpected' | 'flaky';

/** A single execution attempt of a test (one per retry). */
export interface ReportResult {
  /** Duration of this attempt, in milliseconds. */
  duration: number;
  /** Zero-based retry index of this attempt. */
  retry?: number;
}

/** One test = a spec run under a single project. */
export interface ReportTest {
  projectName?: string;
  status?: ReportTestStatus;
  results: ReportResult[];
}

/** A spec (a single `test(...)` call), possibly run under several projects. */
export interface ReportSpec {
  title: string;
  file?: string;
  line?: number;
  tags?: string[];
  tests: ReportTest[];
}

/** A suite groups specs and, recursively, nested suites (describe blocks). */
export interface ReportSuite {
  title?: string;
  file?: string;
  specs: ReportSpec[];
  suites?: ReportSuite[];
}

/** The subset of a Playwright JSON report the pipeline reads. */
export interface PlaywrightReport {
  suites: ReportSuite[];
}
