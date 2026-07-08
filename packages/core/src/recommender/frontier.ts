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
  /**
   * How to split tasks across shards:
   * - 'optimal' (default): the duration-balanced branch-and-bound split.
   * - 'even': a round-robin split that balances test *count*, not duration —
   *   a model of default sharding, used to estimate the *current* pipeline.
   */
  split?: 'optimal' | 'even';
}

/** Round-robin assignment: balances the number of tests, ignoring duration. */
function evenAssignment(taskCount: number, shardCount: number): number[][] {
  const assignment: number[][] = Array.from({ length: shardCount }, () => []);
  for (let index = 0; index < taskCount; index++) {
    assignment[index % shardCount].push(index);
  }
  return assignment;
}

function assertNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite number >= 0, got ${value}`);
  }
}

/**
 * Evaluate a single configuration: split the tasks across `shardCount` shards
 * with the branch-and-bound solver, simulate the run, and measure its
 * wall-clock time and billed cost. This is the atom both the frontier and the
 * "current config" comparison are built from.
 */
export function evaluateConfig(
  durations: readonly number[],
  shardCount: number,
  options: FrontierOptions = {},
): ConfigPoint {
  assertValidDurations(durations);
  const workersPerShard = options.workersPerShard ?? 1;
  const startupOverheadMs = options.startupOverheadMs ?? 0;
  assertNonNegativeFinite(startupOverheadMs, 'startupOverheadMs');

  const even = options.split === 'even';
  const plan = even ? null : branchAndBound(durations, shardCount, options.solve);
  const assignment = plan ? plan.assignment : evenAssignment(durations.length, shardCount);
  const run = simulateRun(durations, assignment, workersPerShard);
  const costMs = run.shards.reduce(
    (sum, shard) => sum + shard.makespan + startupOverheadMs,
    0,
  );
  return {
    shardCount,
    workersPerShard,
    runTimeMs: run.makespan,
    feedbackTimeMs: run.makespan + startupOverheadMs,
    costMs,
    optimal: plan ? plan.optimal : false,
  };
}

/**
 * Build the cost/time frontier: for every shard count from 1 to maxShards,
 * evaluate the configuration. Adding shards trades money for speed — this is
 * the curve the recommender searches for the sweet spot.
 */
export function buildFrontier(
  durations: readonly number[],
  options: FrontierOptions = {},
): ConfigPoint[] {
  const maxShards = options.maxShards ?? Math.max(1, durations.length);
  if (!Number.isInteger(maxShards) || maxShards < 1) {
    throw new RangeError(`maxShards must be an integer >= 1, got ${maxShards}`);
  }

  const points: ConfigPoint[] = [];
  for (let shardCount = 1; shardCount <= maxShards; shardCount++) {
    // The frontier always shows the best achievable split.
    points.push(evaluateConfig(durations, shardCount, { ...options, split: 'optimal' }));
  }
  return points;
}
