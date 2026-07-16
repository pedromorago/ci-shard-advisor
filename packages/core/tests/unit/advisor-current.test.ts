import { describe, expect, it } from 'vitest';
import { readReports } from '../../src/advisor/reports';
import { measureCurrent, modelCurrent } from '../../src/advisor/current';
import { ReportParseError } from '../../src/report/parser';
import { pwReportBare as pwReport, reportFile as file } from '../helpers/reports';

const cost = { startupOverheadMs: 30000 };

describe('readReports', () => {
  it('reads one report per shard', () => {
    const { perShardTasks, allTasks } = readReports({
      kind: 'per-shard',
      reports: [file('shard-1.json', pwReport([10000, 20000])), file('shard-2.json', pwReport([40000]))],
    });
    expect(perShardTasks).toHaveLength(2);
    expect(perShardTasks[0]).toHaveLength(2);
    expect(allTasks).toHaveLength(3);
  });

  it('rejects a mix of report formats with a clear error', () => {
    const cypress = { runs: [{ spec: { relative: 'a.cy.ts' }, tests: [{ title: ['a'], state: 'passed', duration: 1000 }] }] };
    expect(() =>
      readReports({ kind: 'per-shard', reports: [file('pw.json', pwReport([1000])), file('cy.json', cypress)] }),
    ).toThrow(/mixed report formats/);
  });

  it('reads a single merged report', () => {
    const { perShardTasks, allTasks } = readReports({ kind: 'merged', report: file('all.json', pwReport([1000, 2000, 3000])) });
    expect(perShardTasks).toHaveLength(1);
    expect(allTasks).toHaveLength(3);
  });
});

describe('measureCurrent', () => {
  it('computes feedback, cost and imbalance from real per-shard times', () => {
    const { perShardTasks } = readReports({
      kind: 'per-shard',
      reports: [file('s1', pwReport([10000, 20000])), file('s2', pwReport([40000]))],
    });
    const current = measureCurrent(perShardTasks, cost, 1);
    expect(current.shardTimesMs).toEqual([30000, 40000]);
    expect(current.feedbackTimeMs).toBe(70000); // 40000 + 30000 setup
    expect(current.costMs).toBe(130000); // 70000 work + 2*30000 setup
    expect(current.imbalanceMs).toBe(10000);
    expect(current.measured).toBe(true);
  });
});

describe('modelCurrent', () => {
  it('models a merged report with a by-count split (measured=false)', () => {
    const { allTasks } = readReports({ kind: 'merged', report: file('all', pwReport([10000, 10000, 10000, 10000])) });
    const current = modelCurrent(allTasks, 2, { startupOverheadMs: 0 }, 1);
    expect(current.shardCount).toBe(2);
    expect(current.shardTimesMs).toEqual([20000, 20000]); // round-robin, balanced here
    expect(current.imbalanceMs).toBe(0);
    expect(current.measured).toBe(false);
  });
});
