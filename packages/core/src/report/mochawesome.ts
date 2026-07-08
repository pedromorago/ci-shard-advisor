import type { AtomicTask, TaskStatus } from '../types/domain';
import { ReportParseError } from './parser';

/**
 * Minimal typing of a mochawesome JSON report — the de-facto standard reporter
 * for Cypress (and any Mocha runner). Its shape is `results[]` (one per spec),
 * each with nested `suites[]` and `tests[]` — different from the Cypress Module
 * API's `runs[]`, which is why it gets its own reader.
 */
export interface MochaTest {
  title: string;
  fullTitle?: string;
  duration?: number;
  state?: string;
  pending?: boolean;
  skipped?: boolean;
  fail?: boolean;
}

export interface MochaSuite {
  title?: string;
  file?: string;
  tests?: MochaTest[];
  suites?: MochaSuite[];
}

export interface MochawesomeResult {
  file?: string;
  fullFile?: string;
  tests?: MochaTest[];
  suites?: MochaSuite[];
}

export interface MochawesomeReport {
  results: MochawesomeResult[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new ReportParseError(`expected ${path} to be an array`);
  return value;
}

function parseTest(raw: unknown, path: string): MochaTest {
  if (!isObject(raw)) throw new ReportParseError(`expected ${path} to be an object`);
  if (typeof raw.title !== 'string') {
    throw new ReportParseError(`expected ${path}.title to be a string`);
  }
  const test: MochaTest = { title: raw.title };
  if (typeof raw.fullTitle === 'string') test.fullTitle = raw.fullTitle;
  if (typeof raw.duration === 'number') test.duration = raw.duration;
  if (typeof raw.state === 'string') test.state = raw.state;
  if (typeof raw.pending === 'boolean') test.pending = raw.pending;
  if (typeof raw.skipped === 'boolean') test.skipped = raw.skipped;
  if (typeof raw.fail === 'boolean') test.fail = raw.fail;
  return test;
}

function parseSuite(raw: unknown, path: string): MochaSuite {
  if (!isObject(raw)) throw new ReportParseError(`expected ${path} to be an object`);
  const suite: MochaSuite = {};
  if (typeof raw.title === 'string') suite.title = raw.title;
  if (typeof raw.file === 'string') suite.file = raw.file;
  if (raw.tests !== undefined) {
    suite.tests = assertArray(raw.tests, `${path}.tests`).map((t, i) => parseTest(t, `${path}.tests[${i}]`));
  }
  if (raw.suites !== undefined) {
    suite.suites = assertArray(raw.suites, `${path}.suites`).map((s, i) => parseSuite(s, `${path}.suites[${i}]`));
  }
  return suite;
}

/** Parse and validate a mochawesome report (raw JSON string or parsed object). */
export function parseMochawesomeReport(input: string | unknown): MochawesomeReport {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch (error) {
      throw new ReportParseError(`input is not valid JSON: ${(error as Error).message}`);
    }
  }
  if (!isObject(raw)) throw new ReportParseError('expected the report to be an object');

  const results = assertArray(raw.results, 'report.results').map((result, i) => {
    const path = `report.results[${i}]`;
    if (!isObject(result)) throw new ReportParseError(`expected ${path} to be an object`);
    const entry: MochawesomeResult = {};
    if (typeof result.file === 'string') entry.file = result.file;
    if (typeof result.fullFile === 'string') entry.fullFile = result.fullFile;
    if (result.tests !== undefined) {
      entry.tests = assertArray(result.tests, `${path}.tests`).map((t, j) => parseTest(t, `${path}.tests[${j}]`));
    }
    if (result.suites !== undefined) {
      entry.suites = assertArray(result.suites, `${path}.suites`).map((s, j) => parseSuite(s, `${path}.suites[${j}]`));
    }
    return entry;
  });

  return { results };
}

function toTaskStatus(test: MochaTest): TaskStatus {
  if (test.pending || test.skipped || test.state === 'pending') return 'skipped';
  if (test.fail || test.state === 'failed') return 'failed';
  return 'passed';
}

function extractTags(name: string): string[] {
  return name.match(/@[\w-]+/g) ?? [];
}

/** Collect tests from a suite (and its nested suites) into AtomicTasks. */
function collectSuite(suite: MochaSuite, file: string, tasks: AtomicTask[]): void {
  for (const test of suite.tests ?? []) {
    pushTask(test, file, tasks);
  }
  for (const child of suite.suites ?? []) {
    collectSuite({ ...child, file: child.file ?? file }, child.file ?? file, tasks);
  }
}

function pushTask(test: MochaTest, file: string, tasks: AtomicTask[]): void {
  const title = test.fullTitle ?? test.title;
  const tags = extractTags(title);
  const task: AtomicTask = {
    id: `${file}::${title}::${tasks.length}`,
    title: test.title,
    file,
    durationMs: typeof test.duration === 'number' ? test.duration : 0,
    status: toTaskStatus(test),
    retries: 0,
  };
  if (tags.length > 0) task.tags = tags;
  tasks.push(task);
}

/** Flatten a mochawesome report into scheduling units (one per test). */
export function normalizeMochawesome(report: MochawesomeReport): AtomicTask[] {
  const tasks: AtomicTask[] = [];
  for (const result of report.results) {
    const file = result.file ?? result.fullFile ?? '';
    for (const test of result.tests ?? []) {
      pushTask(test, file, tasks);
    }
    for (const suite of result.suites ?? []) {
      collectSuite({ ...suite, file: suite.file ?? file }, suite.file ?? file, tasks);
    }
  }
  return tasks;
}
