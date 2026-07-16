import { describe, expect, it } from 'vitest';
import { advise } from '../../src/advisor/advise';
import { toAdvisorText, toAdvisorJson, toAdvisorMarkdown } from '../../src/exporters/advisor';
import type { ReportFile } from '../../src/advisor/types';

const file = (name: string, content: unknown): ReportFile => ({ name, content });
function pwReport(durations: number[]): unknown {
  return {
    suites: [{ specs: durations.map((duration, i) => ({ title: `t${i}`, file: `t${i}.spec.ts`, tests: [{ status: 'expected', results: [{ duration }] }] })) }],
  };
}

const input = {
  kind: 'per-shard' as const,
  reports: [file('s1', pwReport([50000, 50000])), file('s2', pwReport([10000, 10000]))],
};
const cost = { startupOverheadMs: 30000, pricePerMinute: 0.1, currency: '$' };

describe('advisor exporters', () => {
  it('text output shows current, moves, runnable apply commands and the frontier', () => {
    const text = toAdvisorText(advise(input, cost), cost);
    expect(text).toContain('Your current setup (measured)');
    expect(text).toContain('Your moves');
    expect(text).toMatch(/Rebalance your 2 shards/);
    // The apply block is a real command per shard, not a made-up flag.
    expect(text).toMatch(/shard 1: npx playwright test .*\.spec\.ts/);
    expect(text).not.toMatch(/--shard-weights/);
    expect(text).toContain('Frontier');
    expect(text).toMatch(/\$\d+\.\d\d/); // money shown
  });

  it('json output is stable and carries scenarios, specs and the runner', () => {
    const json = toAdvisorJson(advise(input, cost), cost);
    expect(toAdvisorJson(advise(input, cost), cost)).toBe(json);
    const parsed = JSON.parse(json);
    expect(parsed.current.measured).toBe(true);
    expect(parsed.runner).toBe('playwright');
    const rebalance = parsed.scenarios.find((s: { id: string }) => s.id === 'rebalance');
    // Both shard reports reuse the same file names → the plan groups per file.
    expect(rebalance.specs.flat().sort()).toEqual(['t0.spec.ts', 't1.spec.ts']);
    expect(parsed.frontier[0].price).toMatch(/^\$/);
  });

  it('markdown output renders a moves table', () => {
    const md = toAdvisorMarkdown(advise(input, cost), cost);
    expect(md).toContain('## CI Shard Advisor');
    expect(md).toContain('| Move | Machines | Feedback | Cost |');
  });

  it('omits money when no price is set', () => {
    const text = toAdvisorText(advise(input, { startupOverheadMs: 30000 }), { startupOverheadMs: 30000 });
    expect(text).not.toMatch(/[$€]\d/);
  });

  // Snapshot testing (docs/testing.md §6): the rendered text output is frozen
  // verbatim — any formatting change surfaces as a diff. Possible only because
  // the output is deterministic (no locale, no clock, node-budget solver).
  it('text output is frozen as an inline snapshot', () => {
    expect(toAdvisorText(advise(input, cost), cost)).toMatchInlineSnapshot(`
      "CI Shard Advisor
      ================

      Suite: 4 tests, 2m 0s of test time (Playwright, 2 shard reports)

      Your current setup (measured)
        2 shards × 1 worker
        Feedback time: 2m 10s   (slowest shard: #1)
        Billed cost:   3m 0s  →  $0.30 per run
        ⚠ Imbalance: shard #2 finishes 1m 20s before shard #1. You are paying for idle machines.

      Your moves
        Free) Rebalance your 2 shards   feedback 1m 30s (−40.0s)   cost $0.30 (±0)
           Same machines, specs redistributed by duration — rebalancing is free.
           Apply (each machine runs its own list):
             shard 1: npx playwright test t0.spec.ts
             shard 2: npx playwright test t1.spec.ts
           (--format github or bitbucket emits the full CI config)
        Recommended) 1 shard   feedback 2m 30s (+20.0s)   cost $0.25 (−$0.05)
           The knee of the cost/time frontier — past it, shards stop paying off.
           Apply (each machine runs its own list):
             shard 1: npx playwright test t0.spec.ts t1.spec.ts
           (--format github or bitbucket emits the full CI config)

      Warnings
        • With 2 workers per shard your wait would drop to 1m 20s at no extra cost — same bill, same machines. Validate with one run: scaling is not perfect on small runners.

      Frontier (shards · feedback · billed · price)
         1  2m 30s   2m 30s    $0.25
         2  1m 30s   3m 0s     $0.30"
    `);
  });

  it('markdown output is frozen as an inline snapshot', () => {
    expect(toAdvisorMarkdown(advise(input, cost), cost)).toMatchInlineSnapshot(`
      "## CI Shard Advisor

      **4 tests · 2m 0s of test time**

      ### Your setup today (measured)

      **2 shards** — 2m 10s feedback, $0.30 cost.

      Imbalance: 1m 20s of idle machine time.

      ### Your moves

      | Move | Machines | Feedback | Cost |
      | --- | ---: | ---: | ---: |
      | Rebalance your 2 shards (free) | 2 | 1m 30s | $0.30 |
      | Recommended | 1 | 2m 30s | $0.25 |

      ### Warnings

      - With 2 workers per shard your wait would drop to 1m 20s at no extra cost — same bill, same machines. Validate with one run: scaling is not perfect on small runners."
    `);
  });
});
