import { assertValidDurations } from './validate';

/**
 * Result of simulating one shard's internal worker queue.
 * `makespan` is the shard's real wall-clock time: the moment its last worker
 * goes idle, which is what actually gates the CI run.
 */
export interface SimulationResult {
  /** assignment[w] holds the indices of the tasks that ran on worker w. */
  assignment: number[][];
  /** Busy time per worker, in the same unit as the input durations. */
  loads: number[];
  /** Wall-clock time of the shard: the load of its busiest worker. */
  makespan: number;
}

function assertValidWorkerCount(workerCount: number): void {
  if (!Number.isInteger(workerCount) || workerCount < 1) {
    throw new RangeError(`workerCount must be an integer >= 1, got ${workerCount}`);
  }
}

/**
 * Simulate Playwright's internal worker queue for a single shard.
 *
 * Unlike the scheduler, this is a *faithful model of the real tool*, not an
 * optimizer: it walks the tasks in the given queue order and hands each one to
 * the worker that becomes free earliest (equivalently, the least-loaded worker,
 * since all workers start idle and never sit idle mid-run). It deliberately
 * does NOT reorder tasks, so the estimate reflects what Playwright would
 * actually do — which can be slower than the theoretical optimum.
 *
 * The queue order is the caller's task order; the normalizer decides it.
 */
export function simulateShard(
  durations: readonly number[],
  workerCount: number,
): SimulationResult {
  assertValidWorkerCount(workerCount);
  assertValidDurations(durations);

  const assignment: number[][] = Array.from({ length: workerCount }, () => []);
  const loads = new Array<number>(workerCount).fill(0);

  for (let index = 0; index < durations.length; index++) {
    // The next free worker is the one with the smallest accumulated load.
    let target = 0;
    for (let worker = 1; worker < workerCount; worker++) {
      if (loads[worker] < loads[target]) target = worker;
    }
    assignment[target].push(index);
    loads[target] += durations[index];
  }

  return { assignment, loads, makespan: Math.max(0, ...loads) };
}

/**
 * Whole-run simulation: each shard runs on its own machine (so they run in
 * parallel), and inside each shard `workerCount` workers process its tasks.
 */
export interface RunSimulation {
  /**
   * Per-shard simulation, aligned with the input assignment. Note the task
   * indices inside each shard's `assignment` are local to that shard's task
   * list, not global durations indices.
   */
  shards: SimulationResult[];
  /** Whole-run wall-clock time: the slowest shard gates the run. */
  makespan: number;
}

/**
 * Simulate a full sharded run. Takes the scheduler's per-shard assignment
 * (each entry is the list of global task indices placed on that shard) and
 * runs the worker-queue simulation for every shard. Since shards run on
 * separate machines in parallel, the run finishes when its slowest shard does.
 */
export function simulateRun(
  durations: readonly number[],
  assignment: readonly (readonly number[])[],
  workerCount: number,
): RunSimulation {
  assertValidWorkerCount(workerCount);
  assertValidDurations(durations);

  const shards = assignment.map((taskIndices) =>
    simulateShard(
      taskIndices.map((index) => durations[index]),
      workerCount,
    ),
  );

  return {
    shards,
    makespan: shards.reduce((slowest, shard) => Math.max(slowest, shard.makespan), 0),
  };
}
