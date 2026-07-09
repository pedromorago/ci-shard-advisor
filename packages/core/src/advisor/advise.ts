import { classify } from '../report/classifier';
import { groupByFile } from '../report/normalizer';
import { buildFrontier } from '../recommender/frontier';
import { readReports } from './reports';
import { measureCurrent, modelCurrent } from './current';
import { buildScenarios } from './scenarios';
import { computeFindings } from './findings';
import type { AdvisorResult, AnalyzeInput, CostModel, Objective } from './types';

const SOLVE = { timeBudgetMs: 200 };

export interface AdviseOptions {
  objective?: Objective;
  workersPerShard?: number;
  maxShards?: number;
}

/**
 * The v2 public gate. Reads the report(s), establishes the current situation
 * (measured from per-shard reports, or modeled from a merged one), builds the
 * optimal frontier, and returns the four anchored scenarios plus findings.
 */
export function advise(input: AnalyzeInput, cost: CostModel, options: AdviseOptions = {}): AdvisorResult {
  const workersPerShard = options.workersPerShard ?? 1;
  const { perShardTasks, allTasks, format } = readReports(input);
  // mochawesome is Cypress's reporter — the apply command is Cypress's.
  const runner = format === 'cypress' || format === 'mochawesome' ? 'cypress' : 'playwright';
  const tasks = classify(allTasks);
  // File granularity end-to-end (invariant 11.7): the frontier splits whole
  // spec files, so every promised number is reachable by the emitted plan.
  const durations = groupByFile(tasks).map((group) => group.durationMs);

  const current =
    input.kind === 'per-shard'
      ? measureCurrent(perShardTasks, cost, workersPerShard)
      : modelCurrent(tasks, input.currentShardCount ?? 1, cost, workersPerShard);

  const maxShards = Math.max(
    options.maxShards ?? Math.max(1, durations.length),
    current.shardCount,
  );
  const frontier = buildFrontier(durations, {
    maxShards,
    workersPerShard,
    startupOverheadMs: cost.startupOverheadMs,
    solve: SOLVE,
  });

  const scenarios = buildScenarios(
    frontier,
    current,
    tasks,
    workersPerShard,
    options.objective ?? { kind: 'balanced' },
  );

  return {
    current,
    scenarios,
    frontier,
    findings: computeFindings(frontier, current, tasks, cost),
    tasks,
    runner,
  };
}
