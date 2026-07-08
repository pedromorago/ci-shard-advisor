/**
 * Final status of a task after all retries.
 * 'flaky' means it failed at least once but eventually passed.
 */
export type TaskStatus = 'passed' | 'failed' | 'flaky' | 'skipped';

/**
 * Atomic scheduling unit: either a spec file or an individual test,
 * depending on the granularity chosen by the normalizer.
 */
export interface AtomicTask {
  /** Stable identifier within the report (e.g. file path + title). */
  id: string;
  /** Human-readable title (spec or test name). */
  title: string;
  /** Source file the task belongs to. */
  file: string;
  /** Duration in milliseconds. */
  durationMs: number;
  status: TaskStatus;
  /** Number of retries observed in the report. */
  retries: number;
  /** Machine time spent on extra (retried) attempts, in ms — for flaky findings. */
  wastedMs?: number;
  /** Tags declared on the spec (e.g. '@sanity'); input to the classifier. */
  tags?: string[];
  /** Block assigned by the classifier (sanity, regression, ...). */
  block?: string;
  /** Playwright project, when the report is multi-project. */
  project?: string;
}
