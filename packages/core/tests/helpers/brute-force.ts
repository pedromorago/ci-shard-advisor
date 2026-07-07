/**
 * Reference oracle for the scheduling tests.
 *
 * It computes the true optimal makespan by trying EVERY possible assignment
 * of tasks to shards (shardCount^n combinations). This is deliberately the
 * dumbest possible solver: no bounds, no pruning, no cleverness — so it is
 * obviously correct by inspection. That is exactly what an oracle must be.
 *
 * Because it is exponential it is only usable for tiny instances (keep n small
 * in tests). Its job is to tell us the answer the branch-and-bound solver
 * *should* have produced, without trusting the solver's own logic.
 */
export function bruteForceMakespan(durations: readonly number[], shardCount: number): number {
  if (durations.length === 0) return 0;

  const loads = new Array<number>(shardCount).fill(0);
  let best = Number.POSITIVE_INFINITY;

  const place = (taskIndex: number): void => {
    if (taskIndex === durations.length) {
      const makespan = Math.max(...loads);
      if (makespan < best) best = makespan;
      return;
    }
    for (let shard = 0; shard < shardCount; shard++) {
      loads[shard] += durations[taskIndex];
      place(taskIndex + 1);
      loads[shard] -= durations[taskIndex];
    }
  };

  place(0);
  return best;
}
