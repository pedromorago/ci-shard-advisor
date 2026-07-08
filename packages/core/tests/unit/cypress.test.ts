import { describe, expect, it } from 'vitest';
import { parseCypressReport, normalizeCypress } from '../../src/report/cypress';
import { ReportParseError } from '../../src/report/parser';
import { analyze, detectFormat } from '../../src/report/analyze';
import cypressReport from '../fixtures/cypress-report.json';
import playwrightReport from '../fixtures/demo-report.json';

function tasksFrom(raw: unknown) {
  return normalizeCypress(parseCypressReport(raw));
}

describe('parseCypressReport', () => {
  it('parses a valid run result (object and string)', () => {
    expect(parseCypressReport(cypressReport).runs).toHaveLength(2);
    expect(parseCypressReport(JSON.stringify(cypressReport)).runs).toHaveLength(2);
  });

  it('rejects malformed input with a field path', () => {
    expect(() => parseCypressReport('{ not json')).toThrow(ReportParseError);
    expect(() => parseCypressReport(123)).toThrow(/object/); // a non-object payload
    expect(() => parseCypressReport({})).toThrow(/report\.runs/);
    expect(() => parseCypressReport({ runs: [{ tests: 'nope' }] })).toThrow(/runs\[0\]\.tests/);
    expect(() => parseCypressReport({ runs: [{ tests: [{}] }] })).toThrow(/title/);
  });
});

describe('normalizeCypress — unknown state', () => {
  it('treats a state outside the known set as passed', () => {
    const raw = { runs: [{ spec: { relative: 'a.cy.ts' }, tests: [{ title: ['A', 't'], state: 'weird', duration: 1000 }] }] };
    expect(tasksFrom(raw)[0].status).toBe('passed');
  });
});

describe('normalizeCypress', () => {
  it('turns each Cypress test into one task', () => {
    const tasks = tasksFrom(cypressReport);
    expect(tasks).toHaveLength(5);
    expect(tasks[0]).toMatchObject({
      title: 'logs in with valid credentials @sanity',
      file: 'cypress/e2e/login.cy.ts',
      durationMs: 8200,
      status: 'passed',
      tags: ['@sanity'],
    });
  });

  it('sums attempt durations and marks a retried pass as flaky', () => {
    const discount = tasksFrom(cypressReport).find((t) => t.title === 'applies a discount code');
    expect(discount).toMatchObject({ durationMs: 40800, retries: 1, status: 'flaky' });
  });

  it('maps failed and pending states', () => {
    const tasks = tasksFrom(cypressReport);
    expect(tasks.find((t) => t.title === 'rejects an expired code')).toMatchObject({
      status: 'failed',
      durationMs: 30000,
    });
    expect(tasks.find((t) => t.title === 'skips gift wrapping')?.status).toBe('skipped');
  });
});

describe('analyze with format: cypress', () => {
  it('runs the whole pipeline on a Cypress report', () => {
    const { tasks, recommendation } = analyze(cypressReport, {
      format: 'cypress',
      maxShards: 4,
      startupOverheadMs: 30000,
    });
    expect(tasks).toHaveLength(5);
    expect(tasks.filter((t) => t.block === 'sanity')).toHaveLength(1);
    expect(recommendation.recommended.shardCount).toBeGreaterThanOrEqual(1);
    expect(recommendation.frontier).toHaveLength(4);
  });
});

describe('format auto-detection', () => {
  it('detects Cypress by its top-level runs array, Playwright by suites', () => {
    expect(detectFormat(cypressReport)).toBe('cypress');
    expect(detectFormat(playwrightReport)).toBe('playwright');
    expect(detectFormat(JSON.stringify(cypressReport))).toBe('cypress');
    expect(detectFormat('{ not json')).toBe('playwright');
  });

  it('analyze auto-detects the format when none is given', () => {
    // No `format` option — the Cypress report is recognized from its shape.
    expect(analyze(cypressReport, { maxShards: 4 }).tasks).toHaveLength(5);
    expect(analyze(playwrightReport, { maxShards: 4 }).tasks).toHaveLength(12);
  });
});
