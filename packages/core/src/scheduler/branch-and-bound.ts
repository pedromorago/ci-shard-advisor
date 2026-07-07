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
 * The search assigns tasks one at a time, biggest first, trying each shard.
 * LPT provides the initial incumbent (upper bound); a branch is pruned as soon
 * as a placement would reach a load that cannot strictly beat that incumbent.
 * Shards are identical, so placing a task on two shards that currently hold the
 * same load yields equivalent subtrees — we expand only the first of each
 * distinct load and skip the symmetric duplicates. Because the rest of the tree
 * is still fully explored, the returned makespan stays certified optimal (a
 * later step adds a time budget that can cut the search short).
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
  if (trivial) {
    return { ...incumbent, optimal: true, lowerBound: bound, gap: 0, nodesExplored: 0 };
  }

  // Assign the longest tasks first: placing big jobs early tightens loads
  // quickly and lets the incumbent bound prune far more of the tree.
  const order = durations
    .map((duration, index) => ({ duration, index }))
    .sort((a, b) => b.duration - a.duration);
  const sorted = order.map((o) => o.duration);
  const originalIndex = order.map((o) => o.index);
  const taskCount = sorted.length;

  const loads = new Array<number>(shardCount).fill(0);
  const currentShardOfTask = new Array<number>(taskCount).fill(0);

  let bestMakespan = incumbent.makespan;
  let bestShardOfTask: number[] | null = null;
  let nodesExplored = 0;

  const search = (position: number): void => {
    if (position === taskCount) {
      const makespan = Math.max(...loads);
      if (makespan < bestMakespan) {
        bestMakespan = makespan;
        bestShardOfTask = currentShardOfTask.slice();
      }
      return;
    }
    const seenLoads = new Set<number>();
    for (let shard = 0; shard < shardCount; shard++) {
      // Symmetry breaking: identical shards holding the same load are
      // interchangeable, so only the first of each distinct load is expanded.
      if (seenLoads.has(loads[shard])) continue;
      seenLoads.add(loads[shard]);
      const newLoad = loads[shard] + sorted[position];
      // Prune: this shard alone would already match/exceed the best known
      // makespan, so no completion down this branch can strictly improve it.
      if (newLoad >= bestMakespan) continue;
      nodesExplored++;
      loads[shard] = newLoad;
      currentShardOfTask[position] = shard;
      search(position + 1);
      loads[shard] = newLoad - sorted[position];
    }
  };

  search(0);

  // No improvement over LPT means LPT was already optimal.
  const schedule =
    bestShardOfTask === null
      ? incumbent
      : buildSchedule(bestShardOfTask, sorted, originalIndex, shardCount);

  return { ...schedule, optimal: true, lowerBound: bound, gap: 0, nodesExplored };
}

/** Rebuild an index-based schedule from a shard-per-(sorted)-task decision. */
function buildSchedule(
  shardOfTask: readonly number[],
  sorted: readonly number[],
  originalIndex: readonly number[],
  shardCount: number,
): ScheduleResult {
  const assignment: number[][] = Array.from({ length: shardCount }, () => []);
  const loads = new Array<number>(shardCount).fill(0);
  for (let position = 0; position < shardOfTask.length; position++) {
    const shard = shardOfTask[position];
    assignment[shard].push(originalIndex[position]);
    loads[shard] += sorted[position];
  }
  return { assignment, loads, makespan: Math.max(...loads) };
}
