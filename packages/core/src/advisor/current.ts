import { simulateShard } from '../scheduler/workers';
import { groupByFile } from '../report/normalizer';
import type { AtomicTask } from '../types/domain';
import type { CostModel, MeasuredCurrent } from './types';

/** feedback = max(shard) + setup; billed = Σ shards + N·setup; imbalance = max - min. */
function finalize(shardTimesMs: number[], cost: CostModel, measured: boolean): MeasuredCurrent {
  const setup = cost.startupOverheadMs;
  const slowest = shardTimesMs.length ? Math.max(...shardTimesMs) : 0;
  const fastest = shardTimesMs.length ? Math.min(...shardTimesMs) : 0;
  const total = shardTimesMs.reduce((sum, t) => sum + t, 0);
  return {
    shardCount: shardTimesMs.length,
    shardTimesMs,
    feedbackTimeMs: slowest + setup,
    costMs: total + shardTimesMs.length * setup,
    imbalanceMs: slowest - fastest,
    measured,
  };
}

/**
 * Measure the current setup from one report per shard (real per-shard times).
 * Workers queue whole spec files (invariant 11.7): a file's tests run together.
 */
export function measureCurrent(
  perShardTasks: AtomicTask[][],
  cost: CostModel,
  workersPerShard: number,
): MeasuredCurrent {
  const shardTimesMs = perShardTasks.map(
    (tasks) => simulateShard(groupByFile(tasks).map((g) => g.durationMs), workersPerShard).makespan,
  );
  return finalize(shardTimesMs, cost, true);
}

/**
 * Model the current setup from a merged report + a declared shard count. The
 * split is by-count over spec FILES (how `--shard=i/N` behaves: a file never
 * straddles shards), round-robin.
 */
export function modelCurrent(
  allTasks: AtomicTask[],
  shardCount: number,
  cost: CostModel,
  workersPerShard: number,
): MeasuredCurrent {
  const shards: AtomicTask[][] = Array.from({ length: shardCount }, () => []);
  groupByFile(allTasks).forEach((group, index) => shards[index % shardCount].push(...group.tasks));
  return { ...measureCurrent(shards, cost, workersPerShard), measured: false };
}