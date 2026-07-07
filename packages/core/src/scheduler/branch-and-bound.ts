import { lpt } from './lpt';
import type { ScheduleResult } from './lpt';
import { lowerBound } from './bounds';
import { assertValidDurations, assertValidShardCount } from './validate';

/**
 * Result of the branch-and-bound solver. Extends the plain schedule with the
 * information that makes the engine honest: whether the makespan is *certified*
 * optimal, the lower bound it was compared against, and the gap between them.
 */
export interface SolveResult extends ScheduleResult {
  /** true only if the makespan is proven optimal (no schedule can beat it). */
  optimal: boolean;
  /** Best known lower bound: max(avgBound, pmaxBound). */
  lowerBound: number;
  /** Relative gap (makespan - lowerBound) / lowerBound; 0 when optimal. */
  gap: number;
  /** Nodes explored during the search — 0 when the answer was trivial. */
  nodesExplored: number;
}

export interface SolveOptions {
  /** Wall-clock budget in milliseconds. Search stops when it is exceeded. */
  timeBudgetMs?: number;
  /**
   * Deterministic budget: stop after this many nodes. Used by tests to exercise
   * the "budget exhausted" path without depending on a real clock (no flaky
   * timing). Whichever of the two limits is hit first stops the search.
   */
  maxNodes?: number;
}

/** Relative gap of a makespan against its lower bound. 0 when they coincide. */
function relativeGap(makespan: number, bound: number): number {
  if (bound <= 0) return 0;
  return (makespan - bound) / bound;
}

/**
 * Branch & Bound solver for minimum makespan on identical machines: split n
 * tasks across N shards so the busiest shard finishes as early as possible.
 *
 * Step 1: trivial cases only. When shardCount is 1, or there are at least as
 * many shards as tasks, or the list is empty, LPT is already optimal and we
 * certify it. Otherwise we return LPT's schedule for now (the actual search
 * arrives in the next step) and only claim optimality if it happens to hit the
 * lower bound.
 */
export function branchAndBound(
  durations: readonly number[],
  shardCount: number,
  _options: SolveOptions = {},
): SolveResult {
  assertValidShardCount(shardCount);
  assertValidDurations(durations);

  const bound = lowerBound(durations, shardCount);
  const incumbent = lpt(durations, shardCount);

  // Cases where LPT provably returns the optimum: nothing to search.
  const trivial =
    durations.length === 0 || shardCount === 1 || shardCount >= durations.length;

  const optimal = trivial || incumbent.makespan === bound;

  return {
    ...incumbent,
    optimal,
    lowerBound: bound,
    gap: optimal ? 0 : relativeGap(incumbent.makespan, bound),
    nodesExplored: 0,
  };
}
