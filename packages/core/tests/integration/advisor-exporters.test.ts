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
    expect(md).toContain('| Move | Shards | Feedback | Cost |');
  });

  it('omits money when no price is set', () => {
    const text = toAdvisorText(advise(input, { startupOverheadMs: 30000 }), { startupOverheadMs: 30000 });
    expect(text).not.toMatch(/[$€]\d/);
  });
});
