import { describe, expect, it } from 'vitest';
import { advise } from '../../src/advisor/advise';
import { planFor } from '../../src/advisor/scenarios';
import { toGitHubActions, toBitbucketPipelines } from '../../src/exporters/ci';
import { toAdvisorText } from '../../src/exporters/advisor';
import type { CostModel, ReportFile } from '../../src/advisor/types';
import type { AtomicTask } from '../../src/types/domain';

const cost: CostModel = { startupOverheadMs: 30000 };
import { cyReport as cypressReport, reportFile as file, task as baseTask } from '../helpers/reports';

// These plans speak Cypress: the spec files are *.cy.ts.
const task = (id: string, durationMs: number) => baseTask(id, durationMs, { file: `${id}.cy.ts` });

describe('planFor — plans are always runnable (spec §5.3)', () => {
  it('never emits an empty shard when asked for more shards than spec files', () => {
    const tasks = [task('a', 40000), task('b', 30000), task('c', 20000)];
    const plan = planFor(tasks, 8);
    expect(plan.specs.length).toBeLessThanOrEqual(3);
    expect(plan.specs.every((list) => list.length > 0)).toBe(true);
    expect(plan.shards.every((list) => list.length > 0)).toBe(true);
    // Every spec file appears exactly once across the plan.
    expect(plan.specs.flat().sort()).toEqual(['a.cy.ts', 'b.cy.ts', 'c.cy.ts']);
  });

  it('over-sharded advice still renders runnable commands and valid CI config', () => {
    const result = advise(
      { kind: 'merged', report: file('all.json', cypressReport([40000, 30000, 20000])), currentShardCount: 8 },
      cost,
    );
    const text = toAdvisorText(result, cost);
    expect(text).not.toContain('--spec ""');
    for (const scenario of result.scenarios) {
      if (!scenario.plan) continue;
      expect(() => toGitHubActions(scenario.plan!.specs, result.runner)).not.toThrow();
      expect(() => toBitbucketPipelines(scenario.plan!.specs, result.runner)).not.toThrow();
    }
  });
});

describe('advise — forced input format (spec §3.4)', () => {
  it('honors inputFormat instead of auto-detecting', () => {
    // A mochawesome-shaped report: auto-detection would classify it as
    // mochawesome; forcing 'cypress' must make the Cypress reader reject it.
    const mochawesome = {
      results: [
        { file: 'a.cy.ts', tests: [{ title: 'works', duration: 1000, state: 'passed' }] },
      ],
    };
    const input = { kind: 'merged' as const, report: file('a.json', mochawesome) };
    expect(advise(input, cost).runner).toBe('cypress'); // auto: mochawesome → cypress command
    expect(() => advise(input, cost, { inputFormat: 'cypress' })).toThrow(/report\.runs/);
    expect(advise(input, cost, { inputFormat: 'mochawesome' }).tasks).toHaveLength(1);
  });

  it('applies the forced format to every per-shard file', () => {
    const reports = [
      file('shard-1.json', cypressReport([10000])),
      file('shard-2.json', cypressReport([20000])),
    ];
    const result = advise({ kind: 'per-shard', reports }, cost, { inputFormat: 'cypress' });
    expect(result.current.shardCount).toBe(2);
    expect(result.runner).toBe('cypress');
  });
});
