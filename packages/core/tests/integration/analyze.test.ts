import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/report/analyze';
import demoReport from '../fixtures/demo-report.json';

describe('analyze (end-to-end pipeline)', () => {
  it('turns a real Playwright report into tasks and a recommendation', () => {
    const { tasks, recommendation } = analyze(demoReport, {
      startupOverheadMs: 30000,
      currentShardCount: 8,
    });

    // 12 tests across nested suites and two projects.
    expect(tasks).toHaveLength(12);
    expect(tasks.reduce((sum, t) => sum + t.durationMs, 0)).toBe(244400);

    // The recommendation walks every shard count and picks a member of it.
    expect(recommendation.frontier).toHaveLength(12);
    expect(recommendation.frontier).toContainEqual(recommendation.recommended);
    expect(recommendation.recommended.shardCount).toBeGreaterThanOrEqual(1);
    expect(recommendation.savings).toBeDefined();
  });

  it('preserves the tricky cases through the pipeline', () => {
    const { tasks } = analyze(demoReport);

    const flaky = tasks.find((t) => t.status === 'flaky');
    expect(flaky).toMatchObject({ durationMs: 40800, retries: 1 }); // 21000 + 19800

    const failed = tasks.find((t) => t.status === 'failed');
    expect(failed).toMatchObject({ durationMs: 60000, retries: 1 });

    expect(tasks.some((t) => t.status === 'skipped')).toBe(true);
  });

  it('classifies tagged tests into the sanity block by default', () => {
    const { tasks } = analyze(demoReport);
    const sanity = tasks.filter((t) => t.block === 'sanity');
    const regression = tasks.filter((t) => t.block === 'regression');
    // @sanity login (x2 projects) + @sanity search (x2) + @smoke cart (x1).
    expect(sanity).toHaveLength(5);
    expect(regression).toHaveLength(7);
  });
});
