import type { AtomicTask, TaskStatus } from '../types/domain';
import type {
  PlaywrightReport,
  ReportSpec,
  ReportSuite,
  ReportTestStatus,
} from './playwright-report';

/** Map Playwright's whole-test outcome to our domain status. */
function toTaskStatus(status: ReportTestStatus | undefined): TaskStatus {
  switch (status) {
    case 'skipped':
      return 'skipped';
    case 'flaky':
      return 'flaky';
    case 'unexpected':
      return 'failed';
    default:
      // 'expected' or missing: treat as a normal pass.
      return 'passed';
  }
}

function normalizeSpec(spec: ReportSpec, suiteFile: string | undefined): AtomicTask[] {
  const file = spec.file ?? suiteFile ?? '';
  return spec.tests.map((test) => {
    // A retried test runs several times; the CI machine pays for every attempt.
    const durationMs = test.results.reduce((sum, result) => sum + result.duration, 0);
    const retries = Math.max(0, test.results.length - 1);
    // Wasted = every attempt but the final one.
    const finalMs = test.results.length ? test.results[test.results.length - 1].duration : 0;
    const wastedMs = durationMs - finalMs;
    const project = test.projectName;
    const id = [file, spec.title, project ?? ''].join('::');
    const task: AtomicTask = {
      id,
      title: spec.title,
      file,
      durationMs,
      status: toTaskStatus(test.status),
      retries,
    };
    if (project !== undefined) task.project = project;
    if (wastedMs > 0) task.wastedMs = wastedMs;
    if (spec.tags && spec.tags.length > 0) task.tags = spec.tags;
    return task;
  });
}

function normalizeSuite(suite: ReportSuite): AtomicTask[] {
  const tasks: AtomicTask[] = [];
  for (const spec of suite.specs) {
    tasks.push(...normalizeSpec(spec, suite.file));
  }
  // Recurse into nested describe blocks.
  for (const child of suite.suites ?? []) {
    tasks.push(...normalizeSuite(child));
  }
  return tasks;
}

/**
 * Flatten a parsed report into scheduling units. Each Playwright test (a spec
 * under one project) becomes one AtomicTask, walking nested suites recursively.
 * Its duration is the sum of all attempt durations, so retries — which the CI
 * machine actually re-runs — count toward the load.
 */
export function normalize(report: PlaywrightReport): AtomicTask[] {
  const tasks: AtomicTask[] = [];
  for (const suite of report.suites) {
    tasks.push(...normalizeSuite(suite));
  }
  return tasks;
}

/** Extract the durations the scheduler and recommender operate on. */
export function durationsOf(tasks: readonly AtomicTask[]): number[] {
  return tasks.map((task) => task.durationMs);
}
