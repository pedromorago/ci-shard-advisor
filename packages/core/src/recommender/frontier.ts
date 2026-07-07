import { branchAndBound } from '../scheduler/branch-and-bound';
import type { SolveOptions } from '../scheduler/branch-and-bound';
import { simulateRun } from '../scheduler/workers';
import { assertValidDurations } from '../scheduler/validate';

/**
 * One candidate CI configuration and its simulated cost/time trade-off.
 * All times are in the same unit as the input durations (milliseconds for a
 * Playwright report).
 */
export interface ConfigPoint {
  /** Number of shards (separate CI machines). */
  shardCount: number;
  /** Workers running in parallel inside every shard. */
  workersPerShard: number;
  /** Run wall-clock time: the slowest shard, excluding startup overhead. */
  runTimeMs: number;
  /** What the user waits for: runTimeMs + startup (shards start together). */
  feedbackTimeMs: number;
  /** Billed machine time: sum over shards of (startup overhead + shard time). */
  costMs: number;
  /** Whether the shard split was certified optimal by the solver. */
  optimal: boolean;
}

export interface FrontierOptions {
  /** Largest shard count to evaluate. Defaults to the task count (more shards
   *  than tasks cannot help). */
  maxShards?: number;
  /** Workers per shard (the machine spec). Defaults to 1. */
  workersPerShard?: number;
  /** Per-machine startup overhead added to every shard. Defaults to 0. */
  startupOverheadMs?: number;
  /** Budget forwarded to the branch-and-bound solver for each shard count. */
  solve?: SolveOptions;
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite number >= 0, got ${value}`);
  }
}

/**
 * Build the cost/time frontier: for every shard count from 1 to maxShards,
 * split the tasks with the branch-and-bound solver, simulate the run, and
 * record its wall-clock time and billed cost. Adding shards trades money for
 * speed — this is the curve the recommender searches for the sweet spot.
 */
export function buildFrontier(
  durations: readonly number[],
  options: FrontierOptions = {},
): ConfigPoint[] {
  assertValidDurations(durations);
  const workersPerShard = options.workersPerShard ?? 1;
  const startupOverheadMs = options.startupOverheadMs ?? 0;
  assertNonNegativeFinite(startupOverheadMs, 'startupOverheadMs');

  const maxShards = options.maxShards ?? Math.max(1, durations.length);
  if (!Number.isInteger(maxShards) || maxShards < 1) {
    throw new RangeError(`maxShards must be an integer >= 1, got ${maxShards}`);
  }

  const points: ConfigPoint[] = [];
  for (let shardCount = 1; shardCount <= maxShards; shardCount++) {
    const plan = branchAndBound(durations, shardCount, options.solve);
    const run = simulateRun(durations, plan.assignment, workersPerShard);
    const costMs = run.shards.reduce(
      (sum, shard) => sum + shard.makespan + startupOverheadMs,
      0,
    );
    points.push({
      shardCount,
      workersPerShard,
      runTimeMs: run.makespan,
      feedbackTimeMs: run.makespan + startupOverheadMs,
      costMs,
      optimal: plan.optimal,
    });
  }
  return points;
}
