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

  it('FR-9 warns about imbalance in measured mode', () => {
    const { findings } = advise(overSharded, cost);
    expect(findings.warnings.some((w) => /idle machines/i.test(w))).toBe(true);
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
