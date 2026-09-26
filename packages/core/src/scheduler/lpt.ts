import { assertValidDurations, assertValidShardCount } from './validate';

export interface ScheduleResult {
  /** assignment[s] holds the indices of the tasks placed on shard s. */
  assignment: number[][];
  /** Total load per shard, in the same unit as the input durations. */
  loads: number[];
  /** Load of the busiest shard: the time the whole run takes. */
  makespan: number;
}

/**
 * Longest Processing Time heuristic.
 *
 * Sorts tasks by descending duration and greedily assigns each one to the
 * currently least-loaded shard. Classic guarantee: makespan <= (4/3 - 1/(3N)) * OPT.
 *
 * In this project LPT is not the star: it provides the initial incumbent
 * (upper bound) that lets the branch-and-bound solver prune aggressively,
 * and acts as a safe fallback when the time budget runs out.
 */
export function lpt(durations: readonly number[], shardCount: number): ScheduleResult {
  assertValidShardCount(shardCount);
  assertValidDurations(durations);

  const order = durations
    .map((duration, index) => ({ duration, index }))
    .sort((a, b) => b.duration - a.duration);

  const assignment: number[][] = Array.from({ length: shardCount }, () => []);
  const loads: number[] = new Array(shardCount).fill(0);

  for (const { duration, index } of order) {
    let target = 0;
    for (let shard = 1; shard < shardCount; shard++) {
      if (loads[shard] < loads[target]) target = shard;
    }
    assignment[target].push(index);
    loads[target] += duration;
  }

  return { assignment, loads, makespan: Math.max(...loads) };
}
