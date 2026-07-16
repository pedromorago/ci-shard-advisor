import type { AtomicTask } from '../../src/types/domain';
import type { ReportFile } from '../../src/advisor/types';

/**
 * Shared report/task builders for the advisor tests. One home instead of a
 * copy per suite — the copies had already drifted on whether specs carry a
 * `file`, which silently changes `groupByFile` (file granularity) behavior.
 * Pick the variant that states what your test needs:
 * - `pwReport`      — specs WITH files (one file per spec): the realistic shape.
 * - `pwReportBare`  — specs WITHOUT files: grouping falls back to task ids.
 * - `pwReportSpecs` — full control: [title, file, durationMs] per spec.
 */

export const reportFile = (name: string, content: unknown): ReportFile => ({ name, content });

export const task = (id: string, durationMs: number, overrides: Partial<AtomicTask> = {}): AtomicTask => ({
  id,
  title: id,
  file: `${id}.spec.ts`,
  durationMs,
  status: 'passed',
  retries: 0,
  ...overrides,
});

/** A minimal Playwright report: one spec file per duration. */
export function pwReport(durations: number[], prefix = 't'): unknown {
  return pwReportSpecs(durations.map((d, i) => [`${prefix}${i}`, `${prefix}${i}.spec.ts`, d]));
}

/** Like pwReport but the specs carry NO file — grouping falls back to ids. */
export function pwReportBare(durations: number[], prefix = 't'): unknown {
  return {
    suites: [
      {
        specs: durations.map((duration, i) => ({
          title: `${prefix}${i}`,
          tests: [{ status: 'expected', results: [{ duration }] }],
        })),
      },
    ],
  };
}

/** A Playwright report from explicit [title, file, durationMs] entries. */
export function pwReportSpecs(specs: Array<[string, string, number]>): unknown {
  return {
    suites: [
      {
        specs: specs.map(([title, file, duration]) => ({
          title,
          file,
          tests: [{ status: 'expected', results: [{ duration }] }],
        })),
      },
    ],
  };
}

/** A minimal Cypress Module API report: one spec file per duration. */
export function cyReport(durations: number[], prefix = 'spec'): unknown {
  return {
    runs: durations.map((duration, i) => ({
      spec: { relative: `${prefix}-${i}.cy.ts` },
      tests: [{ title: [`${prefix}-${i}`, 'test'], state: 'passed', duration }],
    })),
  };
}
