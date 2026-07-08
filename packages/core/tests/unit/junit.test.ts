import { describe, expect, it } from 'vitest';
import { parseJUnitReport, normalizeJUnit } from '../../src/report/junit';
import { ReportParseError } from '../../src/report/parser';
import { analyze, detectFormat } from '../../src/report/analyze';

const JUNIT = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="run" tests="4">
  <testsuite name="login.spec.ts" tests="3">
    <testcase classname="login.spec.ts" name="logs in @sanity" time="1.5"/>
    <testcase classname="login.spec.ts" name="fails to log in" time="2">
      <failure message="boom">stack trace</failure>
    </testcase>
    <testcase classname="login.spec.ts" name="skipped path" time="0">
      <skipped/>
    </testcase>
  </testsuite>
  <testsuite name="checkout.spec.ts" tests="1">
    <testcase classname="checkout.spec.ts" name="pays" time="3.25"/>
  </testsuite>
</testsuites>`;

function tasksFrom(xml: string) {
  return normalizeJUnit(parseJUnitReport(xml));
}

describe('parseJUnitReport', () => {
  it('extracts every testcase across suites', () => {
    expect(parseJUnitReport(JUNIT).cases).toHaveLength(4);
  });

  it('handles a bare single testsuite with no <testsuites> wrapper', () => {
    const xml = '<testsuite name="s"><testcase name="only" time="1"/></testsuite>';
    expect(parseJUnitReport(xml).cases).toHaveLength(1);
  });

  it('rejects non-XML and empty reports with a clear error', () => {
    expect(() => parseJUnitReport('{"suites":[]}')).toThrow(/not a JUnit XML report/);
    expect(() => parseJUnitReport({} as unknown)).toThrow(/must be provided as XML text/);
    expect(() => parseJUnitReport('<testsuite name="s"></testsuite>')).toThrow(/no test cases/);
  });
});

describe('normalizeJUnit', () => {
  it('maps time (seconds) to durationMs and derives status and tags', () => {
    const tasks = tasksFrom(JUNIT);
    expect(tasks.map((t) => t.durationMs)).toEqual([1500, 2000, 0, 3250]);
    expect(tasks.map((t) => t.status)).toEqual(['passed', 'failed', 'skipped', 'passed']);
    expect(tasks[0].tags).toEqual(['@sanity']);
    expect(tasks[0].file).toBe('login.spec.ts');
  });

  it('flags a testcase with rerun/flaky elements as flaky', () => {
    const xml =
      '<testsuite name="s"><testcase name="retried" time="1"><rerunFailure message="x"/></testcase></testsuite>';
    const [task] = tasksFrom(xml);
    expect(task.status).toBe('flaky');
    expect(task.retries).toBe(1);
  });
});

describe('JUnit format detection and analyze', () => {
  it('detects XML input as JUnit', () => {
    expect(detectFormat(JUNIT)).toBe('junit');
    expect(detectFormat('  <testsuites/>')).toBe('junit');
  });

  it('analyze auto-detects and runs on a JUnit report', () => {
    const { tasks, recommendation } = analyze(JUNIT, { maxShards: 4, startupOverheadMs: 30000 });
    expect(tasks).toHaveLength(4);
    expect(tasks.filter((t) => t.block === 'sanity')).toHaveLength(1);
    expect(recommendation.recommended.shardCount).toBeGreaterThanOrEqual(1);
  });
});
