import { describe, expect, it } from 'vitest';
import { advise } from '../../src/advisor/advise';
import type { ReportFile } from '../../src/advisor/types';

function pwReport(durations: number[]): unknown {
  return {
    suites: [
      {
        specs: durations.map((duration, i) => ({
          title: `t${i}`,
          tests: [{ status: 'expected', results: [{ duration }] }],
        })),
      },
    ],
  };
}
const file = (name: string, content: unknown): ReportFile => ({ name, content });

// Two shards, badly balanced: one holds both slow tests.
const unbalanced = {
  kind: 'per-shard' as const,
  reports: [file('s1.json', pwReport([50000, 50000])), file('s2.json', pwReport([10000, 10000]))],
};
const cost = { startupOverheadMs: 30000 };

describe('advise — scenarios', () => {
  it('measures the current situation and its imbalance', () => {
    const { current } = advise(unbalanced, cost);
    expect(current.measured).toBe(true);
    expect(current.shardCount).toBe(2);
    expect(current.feedbackTimeMs).toBe(130000); // 100000 slowest + 30000 setup
    expect(current.imbalanceMs).toBe(80000);
  });

  it('FR-5 rebalance: Δcost is exactly 0 and it ships an applicable plan', () => {
    const rebalance = advise(unbalanced, cost).scenarios.find((s) => s.id === 'rebalance')!;
    expect(rebalance.vsCurrent!.costDeltaMs).toBe(0);
    expect(rebalance.vsCurrent!.feedbackDeltaMs).toBeLessThan(0); // faster
    expect(rebalance.plan!.shards.flat()).toHaveLength(4); // every task placed
    // Every spec file lands on exactly one shard.
    const files = rebalance.plan!.specs.flat();
    expect(files).toHaveLength(new Set(files).size);
    expect(rebalance.plan!.specs).toHaveLength(2);
  });

  it('FR-6 same-feedback-cheaper respects feedback <= current', () => {
    const s = advise(unbalanced, cost).scenarios.find((x) => x.id === 'same-feedback-cheaper')!;
    const { current } = advise(unbalanced, cost);
    expect(s.config.feedbackTimeMs).toBeLessThanOrEqual(current.feedbackTimeMs);
  });

  it('FR-7 same-cost-faster respects cost <= current', () => {
    const { scenarios, current } = advise(unbalanced, cost);
    const s = scenarios.find((x) => x.id === 'same-cost-faster')!;
    expect(s.config.costMs).toBeLessThanOrEqual(current.costMs);
  });

  it('flags coinciding scenarios with sameAs', () => {
    const s = advise(unbalanced, cost).scenarios.find((x) => x.id === 'same-cost-faster')!;
    // With one worker the fastest within budget is the rebalance point.
    expect(s.sameAs).toBe('rebalance');
  });

  it('FR-8 objectives: fastest and cheapest hit the frontier extremes', () => {
    const fast = advise(unbalanced, cost, { objective: { kind: 'fastest' } });
    const fastObj = fast.scenarios.find((s) => s.id === 'objective')!;
    expect(fastObj.config.feedbackTimeMs).toBe(Math.min(...fast.frontier.map((p) => p.feedbackTimeMs)));

    const cheap = advise(unbalanced, cost, { objective: { kind: 'cheapest' } });
    const cheapObj = cheap.scenarios.find((s) => s.id === 'objective')!;
    expect(cheapObj.config.costMs).toBe(Math.min(...cheap.frontier.map((p) => p.costMs)));
  });

  it('FR-8 max-feedback objective stays within the feedback budget', () => {
    const { scenarios } = advise(unbalanced, cost, { objective: { kind: 'max-feedback', feedbackMs: 100000 } });
    const obj = scenarios.find((s) => s.id === 'objective')!;
    expect(obj.config.feedbackTimeMs).toBeLessThanOrEqual(100000);
  });

  it('invariant 11.7: the frontier never promises below the heaviest spec file', () => {
    // One 120s spec made of 12 short tests + three light specs. At test
    // granularity more shards would split the big file; at file granularity
    // (reality: a spec is indivisible) it sets the floor everywhere.
    const bigFile = {
      suites: [
        {
          specs: [
            { title: 'big', file: 'big.spec.ts', tests: Array.from({ length: 12 }, () => ({ status: 'expected', results: [{ duration: 10000 }] })) },
            { title: 'a', file: 'a.spec.ts', tests: [{ status: 'expected', results: [{ duration: 5000 }] }] },
            { title: 'b', file: 'b.spec.ts', tests: [{ status: 'expected', results: [{ duration: 5000 }] }] },
            { title: 'c', file: 'c.spec.ts', tests: [{ status: 'expected', results: [{ duration: 5000 }] }] },
          ],
        },
      ],
    };
    const { frontier, scenarios, findings } = advise(
      { kind: 'merged', report: file('all.json', bigFile), currentShardCount: 2 },
      { startupOverheadMs: 10000 },
      { maxShards: 8 },
    );
    // Every promised feedback is reachable by moving whole files: >= 120s + setup.
    for (const point of frontier) {
      expect(point.feedbackTimeMs).toBeGreaterThanOrEqual(120000 + 10000);
    }
    for (const s of scenarios) {
      expect(s.config.feedbackTimeMs).toBeGreaterThanOrEqual(120000 + 10000);
    }
    // And the floor finding names the file with its SUMMED duration.
    expect(findings.warnings.some((w) => w.includes("'big.spec.ts'") && w.includes('2m 0s'))).toBe(true);
  });

  it('FR-2 merged mode models the current setup (measured=false)', () => {
    const { current } = advise(
      { kind: 'merged', report: file('all.json', pwReport([50000, 50000, 10000, 10000])), currentShardCount: 2 },
      cost,
    );
    expect(current.measured).toBe(false);
    expect(current.shardCount).toBe(2);
  });
});
