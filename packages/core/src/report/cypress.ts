import type { AtomicTask, TaskStatus } from '../types/domain';
import { ReportParseError } from './parser';
import type {
  CypressAttempt,
  CypressReport,
  CypressRun,
  CypressTest,
} from './cypress-report';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ReportParseError(`expected ${path} to be an array`);
  }
  return value;
}

function parseAttempt(raw: unknown, path: string): CypressAttempt {
  if (!isObject(raw)) throw new ReportParseError(`expected ${path} to be an object`);
  const attempt: CypressAttempt = {};
  if (typeof raw.duration === 'number') attempt.duration = raw.duration;
  if (typeof raw.wallClockDuration === 'number') attempt.wallClockDuration = raw.wallClockDuration;
  if (typeof raw.state === 'string') attempt.state = raw.state;
  return attempt;
}

function parseTest(raw: unknown, path: string): CypressTest {
  if (!isObject(raw)) throw new ReportParseError(`expected ${path} to be an object`);
  if (!Array.isArray(raw.title) && typeof raw.title !== 'string') {
    throw new ReportParseError(`expected ${path}.title to be a string or array of strings`);
  }
  const test: CypressTest = { title: raw.title as string[] | string };
  if (typeof raw.state === 'string') test.state = raw.state;
  if (typeof raw.duration === 'number') test.duration = raw.duration;
  if (raw.attempts !== undefined) {
    test.attempts = assertArray(raw.attempts, `${path}.attempts`).map((a, i) =>
      parseAttempt(a, `${path}.attempts[${i}]`),
    );
  }
  return test;
}

function parseRun(raw: unknown, path: string): CypressRun {
  if (!isObject(raw)) throw new ReportParseError(`expected ${path} to be an object`);
  const tests = assertArray(raw.tests, `${path}.tests`).map((t, i) =>
    parseTest(t, `${path}.tests[${i}]`),
  );
  const run: CypressRun = { tests };
  if (isObject(raw.spec)) {
    run.spec = {};
    if (typeof raw.spec.name === 'string') run.spec.name = raw.spec.name;
    if (typeof raw.spec.relative === 'string') run.spec.relative = raw.spec.relative;
  }
  return run;
}

/**
 * Parse and validate a Cypress run result (raw JSON string or parsed object).
 * Throws ReportParseError with a field path on anything malformed.
 */
export function parseCypressReport(input: string | unknown): CypressReport {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch (error) {
      throw new ReportParseError(`input is not valid JSON: ${(error as Error).message}`);
    }
  }
  if (!isObject(raw)) {
    throw new ReportParseError('expected the report to be an object');
  }
  const runs = assertArray(raw.runs, 'report.runs').map((r, i) =>
    parseRun(r, `report.runs[${i}]`),
  );
  return { runs };
}

function titleParts(test: CypressTest): string[] {
  return Array.isArray(test.title) ? test.title : [test.title];
}

/** Duration = the test's own duration, or the sum of its attempts. */
function testDuration(test: CypressTest): number {
  if (typeof test.duration === 'number') return test.duration;
  return (test.attempts ?? []).reduce(
    (sum, attempt) => sum + (attempt.duration ?? attempt.wallClockDuration ?? 0),
    0,
  );
}

function toTaskStatus(state: string | undefined, retries: number): TaskStatus {
  switch (state) {
    case 'failed':
      return 'failed';
    case 'pending':
    case 'skipped':
      return 'skipped';
    case 'passed':
      // A pass that needed retries is a flaky test.
      return retries > 0 ? 'flaky' : 'passed';
    default:
      return 'passed';
  }
}

/** Extract `@tag` tokens from a title (a common Cypress tagging convention). */
function extractTags(fullTitle: string): string[] {
  return fullTitle.match(/@[\w-]+/g) ?? [];
}

/**
 * Flatten a Cypress run result into scheduling units — one AtomicTask per test,
 * with retries folded into the duration, so the same scheduler/recommender that
 * serves Playwright reports serves Cypress ones unchanged.
 */
export function normalizeCypress(report: CypressReport): AtomicTask[] {
  const tasks: AtomicTask[] = [];
  for (const run of report.runs) {
    const file = run.spec?.relative ?? run.spec?.name ?? '';
    for (const test of run.tests) {
      const parts = titleParts(test);
      const fullTitle = parts.join(' ');
      const retries = Math.max(0, (test.attempts?.length ?? 1) - 1);
      const tags = extractTags(fullTitle);
      const attempts = test.attempts ?? [];
      const wastedMs = attempts
        .slice(0, -1)
        .reduce((sum, attempt) => sum + (attempt.duration ?? attempt.wallClockDuration ?? 0), 0);
      const task: AtomicTask = {
        id: `${file}::${fullTitle}`,
        title: parts[parts.length - 1] ?? fullTitle,
        file,
        durationMs: testDuration(test),
        status: toTaskStatus(test.state, retries),
        retries,
      };
      if (tags.length > 0) task.tags = tags;
      if (wastedMs > 0) task.wastedMs = wastedMs;
      tasks.push(task);
    }
  }
  return tasks;
}
