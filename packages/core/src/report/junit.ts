import type { AtomicTask, TaskStatus } from '../types/domain';
import { ReportParseError } from './parser';

/**
 * A single <testcase> extracted from a JUnit XML report.
 * JUnit XML is the universal test-result format — Playwright, Cypress, Jest,
 * pytest, Maven/Surefire and many more can emit it — so one reader unlocks
 * almost any tool. `time` is in seconds (the JUnit convention).
 */
export interface JUnitCase {
  name: string;
  classname?: string;
  suite?: string;
  time: number;
  skipped: boolean;
  failed: boolean;
  /** Rerun/flaky elements (Surefire adds these for retried tests). */
  reruns: number;
}

export interface JUnitReport {
  cases: JUnitCase[];
}

/** Extract the attributes of an XML start-tag (double- or single-quoted). */
function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*"([^"]*)"|([\w:.-]+)\s*=\s*'([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag)) !== null) {
    if (match[1] !== undefined) result[match[1]] = match[2];
    else if (match[3] !== undefined) result[match[3]] = match[4];
  }
  return result;
}

/** `@tag` tokens embedded in a test name (a common tagging convention). */
function extractTags(name: string): string[] {
  return name.match(/@[\w-]+/g) ?? [];
}

/** Collect the <testcase> elements inside a chunk of XML. */
function collectCases(body: string, suite: string | undefined, cases: JUnitCase[]): void {
  const caseRe = /<testcase\b([^>]*?)\s*(?:\/>|>([\s\S]*?)<\/testcase\s*>)/g;
  let match: RegExpExecArray | null;
  while ((match = caseRe.exec(body)) !== null) {
    const attrs = attributes(match[1]);
    const inner = match[2] ?? '';
    const time = Number(attrs.time);
    cases.push({
      name: attrs.name ?? '',
      classname: attrs.classname,
      suite,
      time: Number.isFinite(time) && time >= 0 ? time : 0,
      skipped: /<skipped[\s>/]/.test(inner),
      failed: /<(failure|error)[\s>/]/.test(inner),
      reruns: (inner.match(/<(rerunFailure|rerunError|flakyFailure|flakyError)\b/g) ?? []).length,
    });
  }
}

/**
 * Parse a JUnit XML report (as a string) into its test cases. Dependency-free
 * and browser-safe: it works on the standard `<testsuites>/<testsuite>/
 * <testcase>` shape. Throws ReportParseError when the input is not JUnit XML.
 */
export function parseJUnitReport(input: string | unknown): JUnitReport {
  if (typeof input !== 'string') {
    throw new ReportParseError('JUnit report must be provided as XML text');
  }
  if (!/<testsuite\b/.test(input) && !/<testcase\b/.test(input)) {
    throw new ReportParseError('not a JUnit XML report (no <testsuite> or <testcase> found)');
  }

  const cases: JUnitCase[] = [];
  const suiteRe = /<testsuite\b([^>]*?)\s*(?:\/>|>([\s\S]*?)<\/testsuite\s*>)/g;
  let matchedSuite = false;
  let match: RegExpExecArray | null;
  while ((match = suiteRe.exec(input)) !== null) {
    matchedSuite = true;
    if (match[2] !== undefined) {
      collectCases(match[2], attributes(match[1]).name, cases);
    }
  }
  // A report may be a bare list of <testcase> with no enclosing <testsuite>.
  if (!matchedSuite) collectCases(input, undefined, cases);

  if (cases.length === 0) {
    throw new ReportParseError('JUnit XML report contains no test cases');
  }
  return { cases };
}

/** Flatten a parsed JUnit report into scheduling units (one per <testcase>). */
export function normalizeJUnit(report: JUnitReport): AtomicTask[] {
  return report.cases.map((testCase, index) => {
    const file = testCase.classname ?? testCase.suite ?? '';
    const status: TaskStatus = testCase.skipped
      ? 'skipped'
      : testCase.failed
        ? 'failed'
        : testCase.reruns > 0
          ? 'flaky'
          : 'passed';
    const tags = extractTags(testCase.name);
    const task: AtomicTask = {
      id: `${file}::${testCase.name}::${index}`,
      title: testCase.name,
      file,
      durationMs: Math.round(testCase.time * 1000),
      status,
      retries: testCase.reruns,
    };
    if (tags.length > 0) task.tags = tags;
    return task;
  });
}
