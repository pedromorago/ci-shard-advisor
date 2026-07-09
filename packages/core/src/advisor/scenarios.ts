import { branchAndBound } from '../scheduler/branch-and-bound';
import { findElbow } from '../recommender/elbow';
import { groupByFile } from '../report/normalizer';
import type { ConfigPoint } from '../recommender/frontier';
import type { AtomicTask } from '../types/domain';
import { unitOf } from '../exporters/advisor';
import type { MeasuredCurrent, Objective, Runner, Scenario, ShardPlan } from './types';

const SOLVE = { timeBudgetMs: 200 };

/** Lexicographic tuple comparison (a < b). */
function tupleLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/** The item minimizing a key tuple (first wins on ties). */
function minBy<T>(items: T[], key: (item: T) => number[]): T | undefined {
  let best: T | undefined;
  let bestKey: number[] | undefined;
  for (const item of items) {
    const k = key(item);
    if (bestKey === undefined || tupleLess(k, bestKey)) {
      best = item;
      bestKey = k;
    }
  }
  return best;
}

/** The frontier point at a given shard count (clamped to the frontier range). */
function pointAt(frontier: ConfigPoint[], shardCount: number): ConfigPoint {
  return frontier[Math.min(shardCount, frontier.length) - 1];
}

function deltas(config: ConfigPoint, current: MeasuredCurrent) {
  return {
    feedbackDeltaMs: config.feedbackTimeMs - current.feedbackTimeMs,
    costDeltaMs: config.costMs - current.costMs,
  };
}

/**
 * Build the applicable split plan. Scheduling happens at FILE granularity —
 * you cannot route half a spec file to a shard — so tasks are grouped by file
 * (falling back to the task id when the report carries no file) and the solver
 * splits the files. `specs` is what each CI job actually runs.
 */
export function planFor(
  tasks: AtomicTask[],
  shardCount: number,
  workersPerShard: number,
): ShardPlan {
  const groups = groupByFile(tasks);
  const plan = branchAndBound(groups.map((g) => g.durationMs), shardCount, SOLVE);
  const specs = plan.assignment.map((indices) => indices.map((i) => groups[i].file).sort());
  const shards = plan.assignment.map((indices) =>
    indices.flatMap((i) => groups[i].tasks.map((t) => t.id)),
  );
  return { shards, specs };
}

/** Pick the frontier point for the "objective" scenario. */
export function chooseObjective(frontier: ConfigPoint[], objective: Objective): ConfigPoint {
  switch (objective.kind) {
    case 'balanced':
      return findElbow(frontier);
    case 'fastest':
      return minBy(frontier, (p) => [p.feedbackTimeMs, p.shardCount])!;
    case 'cheapest':
      return minBy(frontier, (p) => [p.costMs, p.shardCount])!;
    case 'max-feedback': {
      const feasible = frontier.filter((p) => p.feedbackTimeMs <= objective.feedbackMs);
      return (
        minBy(feasible, (p) => [p.costMs, p.shardCount]) ??
        minBy(frontier, (p) => [p.feedbackTimeMs, p.shardCount])!
      );
    }
    case 'budget': {
      const feasible = frontier.filter((p) => p.costMs <= objective.costMs);
      return (
        minBy(feasible, (p) => [p.feedbackTimeMs, p.shardCount]) ??
        minBy(frontier, (p) => [p.costMs, p.shardCount])!
      );
    }
    case 'weight':
      return minBy(frontier, (p) => [
        p.costMs + objective.costPerFeedbackMinute * (p.feedbackTimeMs / 60000),
        p.shardCount,
      ])!;
  }
}

/**
 * Build the four scenarios anchored to the current situation (spec §5.2). Every
 * scenario is a query against the optimal frontier; coincidences are flagged
 * with `sameAs`, absent ones with `unavailable`.
 */
export function buildScenarios(
  frontier: ConfigPoint[],
  current: MeasuredCurrent,
  tasks: AtomicTask[],
  workersPerShard: number,
  objective: Objective,
  runner: Runner = 'playwright',
): Scenario[] {
  // 1) Rebalance: optimal split at the current shard count. Δcost = 0 by design.
  const rebalanceConfig = pointAt(frontier, current.shardCount);
  const rebalance: Scenario = {
    id: 'rebalance',
    config: rebalanceConfig,
    vsCurrent: deltas(rebalanceConfig, current),
    reason: 'Same machines, tests redistributed by duration — rebalancing is free.',
    plan: planFor(tasks, current.shardCount, workersPerShard),
  };

  // 2) Same wait, cheaper: argmin cost s.t. feedback <= current feedback.
  const cheaper = minBy(
    frontier.filter((p) => p.feedbackTimeMs <= current.feedbackTimeMs),
    (p) => [p.costMs, p.shardCount],
  );
  const sameFeedbackCheaper: Scenario = cheaper
    ? {
        id: 'same-feedback-cheaper',
        config: cheaper,
        vsCurrent: deltas(cheaper, current),
        reason:
          cheaper.shardCount < current.shardCount
            ? `${cheaper.shardCount} shards still beat your current wait.`
            : 'Keeps your wait at a lower cost.',
        plan: planFor(tasks, cheaper.shardCount, workersPerShard),
      }
    : {
        id: 'same-feedback-cheaper',
        config: rebalanceConfig,
        reason: 'Nothing cheaper keeps your current wait.',
        unavailable: true,
      };

  // 3) Same cost, faster: argmin feedback s.t. cost <= current cost.
  const faster = minBy(
    frontier.filter((p) => p.costMs <= current.costMs),
    (p) => [p.feedbackTimeMs, p.shardCount],
  );
  const sameCostFaster: Scenario = faster
    ? {
        id: 'same-cost-faster',
        config: faster,
        vsCurrent: deltas(faster, current),
        reason: 'Your current budget buys a faster pipeline.',
        plan: planFor(tasks, faster.shardCount, workersPerShard),
      }
    : {
        id: 'same-cost-faster',
        config: rebalanceConfig,
        reason: 'Nothing faster fits your current cost.',
        unavailable: true,
      };

  // 4) By objective.
  const objectiveConfig = chooseObjective(frontier, objective);
  const objectiveScenario: Scenario = {
    id: 'objective',
    config: objectiveConfig,
    vsCurrent: deltas(objectiveConfig, current),
    reason: objectiveReason(objective, runner),
    plan: planFor(tasks, objectiveConfig.shardCount, workersPerShard),
    objective,
  };

  const scenarios = [rebalance, sameFeedbackCheaper, sameCostFaster, objectiveScenario];
  return flagCoincidences(scenarios);
}

function objectiveReason(objective: Objective, runner: Runner): string {
  switch (objective.kind) {
    case 'balanced':
      return `The knee of the cost/time frontier — past it, ${unitOf(runner)}s stop paying off.`;
    case 'fastest':
      return 'The fastest feedback available.';
    case 'cheapest':
      return 'The cheapest configuration.';
    case 'max-feedback':
      return 'The cheapest configuration within your feedback budget.';
    case 'budget':
      return 'The fastest configuration within your cost budget.';
    case 'weight':
      return 'The best cost/time trade-off for your weighting.';
  }
}

/** Flag a later scenario that lands on the same config as an earlier one. */
function flagCoincidences(scenarios: Scenario[]): Scenario[] {
  return scenarios.map((scenario, i) => {
    if (scenario.unavailable) return scenario;
    const earlier = scenarios
      .slice(0, i)
      .find((prev) => !prev.unavailable && prev.config.shardCount === scenario.config.shardCount);
    return earlier ? { ...scenario, sameAs: earlier.id } : scenario;
  });
}
