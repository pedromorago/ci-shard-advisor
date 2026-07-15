import { classify } from '../report/classifier';
import { groupByFile } from '../report/normalizer';
import { buildFrontier } from '../recommender/frontier';
import { readReports } from './reports';
import { feedbackAtWorkers, measureCurrent, modelCurrent, splitByCount } from './current';
import { buildScenarios } from './scenarios';
import { computeFindings } from './findings';
import type { ReportFormat } from '../report/analyze';
import type { AdvisorResult, AnalyzeInput, CostModel, Objective } from './types';

// Deterministic solver budget (invariant 4: same input → same output on any
// machine). A node is cheap, so this certifies every realistic suite while
// still bounding worst-case latency; when exhausted the B&B stays honest
// (optimal: false + gap).
const SOLVE = { maxNodes: 200_000 };

export interface AdviseOptions {
  objective?: Objective;
  workersPerShard?: number;
  maxShards?: number;
  /** Force the report format instead of auto-detecting it (spec §3.4). */
  inputFormat?: ReportFormat;
}

/**
 * The v2 public gate. Reads the report(s), establishes the current situation
 * (measured from per-shard reports, or modeled from a merged one), builds the
 * optimal frontier, and returns the four anchored scenarios plus findings.
 */
export function advise(input: AnalyzeInput, cost: CostModel, options: AdviseOptions = {}): AdvisorResult {
  const { perShardTasks, allTasks, format } = readReports(input, options.inputFormat);
  // mochawesome is Cypress's reporter — the apply command is Cypress's.
  const runner = format === 'cypress' || format === 'mochawesome' ? 'cypress' : 'playwright';
  // Cypress runs the specs of a machine serially: workers are forced to 1 (FR-13).
  const workersPerShard = runner === 'cypress' ? 1 : options.workersPerShard ?? 1;
  const tasks = classify(allTasks);
  // File granularity end-to-end (invariant 11.7): the frontier splits whole
  // spec files, so every promised number is reachable by the emitted plan.
  const durations = groupByFile(tasks).map((group) => group.durationMs);

  const current =
    input.kind === 'per-shard'
      ? measureCurrent(perShardTasks, cost, workersPerShard)
      : modelCurrent(tasks, input.currentShardCount ?? 1, cost, workersPerShard);

  // "Workers before machines" (FR-13): what the SAME machines would give with
  // one more worker each. Playwright-only — Cypress has no in-machine workers.
  const shardLayout =
    input.kind === 'per-shard' ? perShardTasks : splitByCount(tasks, current.shardCount);
  const workersUpgrade =
    runner === 'playwright'
      ? { workers: workersPerShard + 1, feedbackMs: feedbackAtWorkers(shardLayout, cost, workersPerShard + 1) }
      : undefined;

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
    runner,
  );

  return {
    current,
    scenarios,
    frontier,
    findings: computeFindings(frontier, current, tasks, cost, workersUpgrade, runner),
    tasks,
    runner,
  };
}
