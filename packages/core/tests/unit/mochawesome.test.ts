import { describe, expect, it } from 'vitest';
import { parseMochawesomeReport, normalizeMochawesome } from '../../src/report/mochawesome';
import { ReportParseError } from '../../src/report/parser';
import { analyze, detectFormat } from '../../src/report/analyze';
import mochawesomeReport from '../fixtures/mochawesome-report.json';

function tasksFrom(raw: unknown) {
  return normalizeMochawesome(parseMochawesomeReport(raw));
}

describe('parseMochawesomeReport', () => {
  it('parses a valid report (object and string)', () => {
    expect(parseMochawesomeReport(mochawesomeReport).results).toHaveLength(2);
    expect(parseMochawesomeReport(JSON.stringify(mochawesomeReport)).results).toHaveLength(2);
  });

  it('rejects malformed input with a field path', () => {
    expect(() => parseMochawesomeReport('{ not json')).toThrow(ReportParseError);
    expect(() => parseMochawesomeReport({})).toThrow(/report\.results/);
    expect(() => parseMochawesomeReport({ results: [{ suites: [{ tests: [{}] }] }] })).toThrow(/title/);
  });
});

describe('normalizeMochawesome', () => {
  it('flattens nested suites into one task per test', () => {
    const tasks = tasksFrom(mochawesomeReport);
    expect(tasks).toHaveLength(4);
    expect(tasks[0]).toMatchObject({
      title: 'logs in with valid credentials @sanity',
      file: 'cypress/e2e/login.cy.ts',
      durationMs: 8000,
      status: 'passed',
      tags: ['@sanity'],
    });
  });

  it('maps failed and pending states', () => {
    const tasks = tasksFrom(mochawesomeReport);
    expect(tasks.find((t) => t.title === 'completes a purchase')?.status).toBe('failed');
    expect(tasks.find((t) => t.title === 'skips gift wrapping')?.status).toBe('skipped');
  });
});

describe('mochawesome format detection and analyze', () => {
  it('detects a top-level results array as mochawesome', () => {
    expect(detectFormat(mochawesomeReport)).toBe('mochawesome');
    expect(detectFormat(JSON.stringify(mochawesomeReport))).toBe('mochawesome');
  });

  it('analyze auto-detects and runs on a mochawesome report', () => {
    const { tasks, recommendation } = analyze(mochawesomeReport, { maxShards: 4, startupOverheadMs: 30000 });
    expect(tasks).toHaveLength(4);
    expect(tasks.filter((t) => t.block === 'sanity')).toHaveLength(1);
    expect(recommendation.recommended.shardCount).toBeGreaterThanOrEqual(1);
  });
});
