import type {
  PlaywrightReport,
  ReportResult,
  ReportSpec,
  ReportSuite,
  ReportTest,
} from './playwright-report';

/** Thrown when the input is not a recognizable Playwright JSON report. */
export class ReportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportParseError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ReportParseError(`expected ${path} to be an array`);
  }
  return value;
}

function parseResult(raw: unknown, path: string): ReportResult {
  if (!isObject(raw)) {
    throw new ReportParseError(`expected ${path} to be an object`);
  }
  if (typeof raw.duration !== 'number' || !Number.isFinite(raw.duration) || raw.duration < 0) {
    throw new ReportParseError(`expected ${path}.duration to be a finite number >= 0`);
  }
  const result: ReportResult = { duration: raw.duration };
  if (typeof raw.retry === 'number') result.retry = raw.retry;
  return result;
}

function parseTest(raw: unknown, path: string): ReportTest {
  if (!isObject(raw)) {
    throw new ReportParseError(`expected ${path} to be an object`);
  }
  const results = assertArray(raw.results, `${path}.results`).map((r, i) =>
    parseResult(r, `${path}.results[${i}]`),
  );
  const test: ReportTest = { results };
  if (typeof raw.projectName === 'string') test.projectName = raw.projectName;
  if (typeof raw.status === 'string') test.status = raw.status as ReportTest['status'];
  return test;
}

function parseSpec(raw: unknown, path: string): ReportSpec {
  if (!isObject(raw)) {
    throw new ReportParseError(`expected ${path} to be an object`);
  }
  if (typeof raw.title !== 'string') {
    throw new ReportParseError(`expected ${path}.title to be a string`);
  }
  const tests = assertArray(raw.tests, `${path}.tests`).map((t, i) =>
    parseTest(t, `${path}.tests[${i}]`),
  );
  const spec: ReportSpec = { title: raw.title, tests };
  if (typeof raw.file === 'string') spec.file = raw.file;
  if (typeof raw.line === 'number') spec.line = raw.line;
  if (Array.isArray(raw.tags)) {
    spec.tags = raw.tags.filter((tag): tag is string => typeof tag === 'string');
  }
  return spec;
}

function parseSuite(raw: unknown, path: string): ReportSuite {
  if (!isObject(raw)) {
    throw new ReportParseError(`expected ${path} to be an object`);
  }
  const specs = assertArray(raw.specs, `${path}.specs`).map((s, i) =>
    parseSpec(s, `${path}.specs[${i}]`),
  );
  const suite: ReportSuite = { specs };
  if (typeof raw.title === 'string') suite.title = raw.title;
  if (typeof raw.file === 'string') suite.file = raw.file;
  if (raw.suites !== undefined) {
    suite.suites = assertArray(raw.suites, `${path}.suites`).map((s, i) =>
      parseSuite(s, `${path}.suites[${i}]`),
    );
  }
  return suite;
}

/**
 * Parse and validate a Playwright JSON report. Accepts the raw JSON string or
 * an already-parsed object (the core never touches the filesystem, so reading
 * is the adapter's job). Throws ReportParseError with a field path on anything
 * that does not match the expected shape.
 */
export function parseReport(input: string | unknown): PlaywrightReport {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch (error) {
      throw new ReportParseError(
        `input is not valid JSON: ${(error as Error).message}`,
      );
    }
  }
  if (!isObject(raw)) {
    throw new ReportParseError('expected the report to be an object');
  }
  const suites = assertArray(raw.suites, 'report.suites').map((s, i) =>
    parseSuite(s, `report.suites[${i}]`),
  );
  return { suites };
}
