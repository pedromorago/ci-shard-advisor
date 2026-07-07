import { describe, expect, it } from 'vitest';
import { parseReport, ReportParseError } from '../../src/report/parser';

/** A tiny but complete valid report used as a baseline to mutate. */
function validReport() {
  return {
    suites: [
      {
        title: 'login.spec.ts',
        file: 'login.spec.ts',
        specs: [
          {
            title: 'logs in',
            file: 'login.spec.ts',
            tags: ['@sanity'],
            tests: [
              { projectName: 'chromium', status: 'expected', results: [{ duration: 1200, retry: 0 }] },
            ],
          },
        ],
        suites: [],
      },
    ],
  };
}

describe('parseReport', () => {
  it('parses a valid report object', () => {
    const report = parseReport(validReport());
    expect(report.suites).toHaveLength(1);
    expect(report.suites[0].specs[0].tests[0].results[0].duration).toBe(1200);
  });

  it('parses a valid report from a JSON string', () => {
    const report = parseReport(JSON.stringify(validReport()));
    expect(report.suites[0].specs[0].title).toBe('logs in');
  });

  it('keeps only known fields and tolerates extra ones', () => {
    const raw = validReport() as Record<string, unknown>;
    raw.config = { foo: 'bar' };
    raw.stats = { duration: 999 };
    expect(() => parseReport(raw)).not.toThrow();
  });

  it('tolerates missing optional fields (projectName, tags, nested suites)', () => {
    const report = parseReport({
      suites: [{ specs: [{ title: 't', tests: [{ results: [{ duration: 5 }] }] }] }],
    });
    expect(report.suites[0].specs[0].tests[0].results[0].duration).toBe(5);
  });

  describe('rejects malformed input', () => {
    it('throws on invalid JSON strings', () => {
      expect(() => parseReport('{ not json')).toThrow(ReportParseError);
    });

    it('throws when the report is not an object', () => {
      expect(() => parseReport(42)).toThrow(ReportParseError);
      expect(() => parseReport([])).toThrow(/be an object/);
    });

    it('throws when suites is missing or not an array', () => {
      expect(() => parseReport({})).toThrow(/report\.suites/);
      expect(() => parseReport({ suites: 'nope' })).toThrow(/report\.suites/);
    });

    it('points at the offending field path', () => {
      const bad = validReport();
      // @ts-expect-error deliberately corrupt the duration
      bad.suites[0].specs[0].tests[0].results[0].duration = 'slow';
      expect(() => parseReport(bad)).toThrow(
        /report\.suites\[0\]\.specs\[0\]\.tests\[0\]\.results\[0\]\.duration/,
      );
    });

    it('throws when a spec has no title', () => {
      const bad = validReport();
      // @ts-expect-error remove required title
      delete bad.suites[0].specs[0].title;
      expect(() => parseReport(bad)).toThrow(/specs\[0\]\.title/);
    });

    it('throws when tests is not an array', () => {
      const bad = validReport();
      // @ts-expect-error corrupt tests
      bad.suites[0].specs[0].tests = { nope: true };
      expect(() => parseReport(bad)).toThrow(/tests/);
    });

    it('rejects negative durations', () => {
      const bad = validReport();
      bad.suites[0].specs[0].tests[0].results[0].duration = -1;
      expect(() => parseReport(bad)).toThrow(ReportParseError);
    });
  });
});
