import { describe, expect, it } from 'vitest';
import { advise } from '../../src/advisor/advise';
import type { ReportFile } from '../../src/advisor/types';

const file = (name: string, content: unknown): ReportFile => ({ name, content });

/** Playwright report from spec entries: [title, file, durationMs]. */
function pwReport(specs: Array<[string, string, number]>): unknown {
  return {
    suites: [
      {
        specs: specs.map(([title, f, duration]) => ({
          title,
          file: f,
          tests: [{ status: 'expected', results: [{ duration }] }],
        })),
      },
    ],
  };
}

// One shard holds a 60s bottleneck; five hold a 5s test each. 6 shards total.
const overSharded = {
  kind: 'per-shard' as const,
  reports: [
    file('s1', pwReport([['heavy', 'checkout.spec.ts', 60000]])),
    file('s2', pwReport([['a', 'a.spec.ts', 5000]])),
    file('s3', pwReport([['b', 'b.spec.ts', 5000]])),
    file('s4', pwReport([['c', 'c.spec.ts', 5000]])),
    file('s5', pwReport([['d', 'd.spec.ts', 5000]])),
    file('s6', pwReport([['e', 'e.spec.ts', 5000]])),
  ],
};
const cost = { startupOverheadMs: 30000 };

describe('advise — findings (spec §5.5)', () => {
  it('FR-9 warns about over-fragmentation', () => {
    const { findings } = advise(overSharded, cost);
    expect(findings.warnings.some((w) => /you run 6 shards/i.test(w))).toBe(true);
  });

  it('FR-9 names the bottleneck test that sets the floor', () => {
    const { findings } = advise(overSharded, cost);
    expect(findings.warnings.some((w) => /sets the floor/i.test(w) && /checkout\.spec\.ts/.test(w))).toBe(true);
  });

  it('FR-9 exposes imbalance on the measured current, without duplicating it as a warning', () => {
    const { current, findings } = advise(overSharded, cost);
    // The imbalance belongs to the current-situation block (spec §5.1/§7.1);
    // adapters render it inline there, so it must not repeat in the warnings.
    expect(current.imbalanceMs).toBeGreaterThan(0);
    expect(findings.warnings.some((w) => /idle machines/i.test(w))).toBe(false);
  });

  it('FR-10 lists flaky tests with retries and wasted machine time', () => {
    const flakyReport = {
      suites: [
        {
          specs: [
            {
              title: 'flaky one',
              file: 'x.spec.ts',
              tests: [
                {
                  status: 'flaky',
                  results: [
                    { duration: 20000, retry: 0 },
                    { duration: 18000, retry: 1 },
                  ],
                },
              ],
            },
            { title: 'ok', file: 'y.spec.ts', tests: [{ status: 'expected', results: [{ duration: 5000 }] }] },
          ],
        },
      ],
    };
    const { findings } = advise({ kind: 'merged', report: file('r', flakyReport), currentShardCount: 1 }, { startupOverheadMs: 0 });
    expect(findings.flaky).toHaveLength(1);
    expect(findings.flaky[0]).toMatchObject({ retries: 1, wastedMs: 20000 }); // 38000 total − 18000 final
    expect(findings.warnings.some((w) => /flaky/i.test(w) && /retries/i.test(w))).toBe(true);
  });

  it('FR-13 suggests workers before machines when W+1 cuts the wait', () => {
    // One shard holds two 60s files: with 2 workers they run side by side.
    const twoFiles = {
      kind: 'per-shard' as const,
      reports: [file('s1', pwReport([['a', 'a.spec.ts', 60000], ['b', 'b.spec.ts', 60000]]))],
    };
    const { findings, current } = advise(twoFiles, cost);
    const workers = findings.warnings.find((w) => /workers per shard/.test(w));
    expect(workers).toBeDefined();
    // 2 workers: 60s makespan + 30s setup = 1m 30s (vs 2m 30s today).
    expect(workers).toContain('With 2 workers per shard');
    expect(workers).toContain('1m 30s');
    expect(current.feedbackTimeMs).toBe(150000);
  });

  it('FR-13 stays silent when an extra worker buys nothing', () => {
    // Single file per shard: a file is indivisible, so W+1 cannot help.
    const { findings } = advise(overSharded, cost);
    expect(findings.warnings.some((w) => /workers per shard/.test(w))).toBe(false);
  });

  it('FR-13 never suggests workers for Cypress, and forces W to 1', () => {
    const cyReport = {
      runs: [
        {
          spec: { relative: 'a.cy.ts' },
          tests: [{ title: ['A', 't1'], state: 'passed', duration: 60000 }],
        },
        {
          spec: { relative: 'b.cy.ts' },
          tests: [{ title: ['B', 't2'], state: 'passed', duration: 60000 }],
        },
      ],
    };
    const input = { kind: 'per-shard' as const, reports: [file('c1', cyReport), file('c2', cyReport)] };
    const withWorkers = advise(input, cost, { workersPerShard: 2 });
    expect(withWorkers.findings.warnings.some((w) => /workers per shard/.test(w))).toBe(false);
    // Requesting 2 workers changes nothing: Cypress runs a machine's specs serially.
    expect(withWorkers.current.feedbackTimeMs).toBe(advise(input, cost).current.feedbackTimeMs);
  });

  it('formats savings in money when a price is given', () => {
    const underSharded = {
      kind: 'merged' as const,
      report: file('r', pwReport([['a', 'a', 20000], ['b', 'b', 20000], ['c', 'c', 20000], ['d', 'd', 20000]])),
      currentShardCount: 1,
    };
    const { findings } = advise(underSharded, { startupOverheadMs: 10000, pricePerMinute: 0.1, currency: '$' });
    expect(findings.warnings.some((w) => /cut the wait/i.test(w) && /\$/.test(w))).toBe(true);
  });
});
