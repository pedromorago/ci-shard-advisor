import { describe, expect, it } from 'vitest';
import { simulateShard, simulateRun } from '../../src/scheduler/workers';
import { branchAndBound } from '../../src/scheduler/branch-and-bound';
import { lpt } from '../../src/scheduler/lpt';
import { mulberry32, randomInt } from '../helpers/random';

describe('simulateShard', () => {
  describe('input validation', () => {
    it('rejects invalid worker counts', () => {
      expect(() => simulateShard([1], 0)).toThrow(RangeError);
      expect(() => simulateShard([1], -1)).toThrow(RangeError);
      expect(() => simulateShard([1], 1.5)).toThrow(RangeError);
    });

    it('rejects negative or non-finite durations', () => {
      expect(() => simulateShard([-5], 2)).toThrow(RangeError);
      expect(() => simulateShard([Number.NaN], 2)).toThrow(RangeError);
    });
  });

  describe('edge cases', () => {
    it('runs everything sequentially on a single worker', () => {
      const result = simulateShard([10, 20, 5], 1);
      expect(result.makespan).toBe(35);
      expect(result.assignment[0]).toHaveLength(3);
    });

    it('drops to the longest task when workers outnumber tasks', () => {
      expect(simulateShard([10, 20, 5], 5).makespan).toBe(20);
    });

    it('handles an empty task list', () => {
      const result = simulateShard([], 3);
      expect(result.makespan).toBe(0);
      expect(result.assignment).toEqual([[], [], []]);
    });
  });

  describe('models the real queue in input order (no reordering)', () => {
    it('assigns each task to the worker that frees up first', () => {
      // [1,1,1,3] over 2 workers, IN ORDER (ties keep the lower-index worker):
      // t0->w0[1], t1->w1[1], t2->w0[2], t3->w1[1+3=4] -> makespan 4.
      // An optimizer would reach 3 ({3} vs {1,1,1}); the real queue does not.
      const result = simulateShard([1, 1, 1, 3], 2);
      expect(result.loads).toEqual([2, 4]);
      expect(result.makespan).toBe(4);
    });
  });

  describe('is a faithful (never optimistic) model', () => {
    it('the same tasks in a different order can take longer', () => {
      // Big-first happens to be optimal here; the unsorted queue is not.
      expect(simulateShard([3, 1, 1, 1], 2).makespan).toBe(3);
      expect(simulateShard([1, 1, 1, 3], 2).makespan).toBe(4);
    });

    it('never beats the theoretical optimum computed by branch-and-bound', () => {
      const random = mulberry32(53);
      for (let i = 0; i < 200; i++) {
        const taskCount = randomInt(random, 1, 12);
        const workerCount = randomInt(random, 1, 5);
        const durations = Array.from({ length: taskCount }, () =>
          randomInt(random, 1, 200),
        );
        // Workers within a shard are identical machines: the best any schedule
        // could do is exactly the branch-and-bound optimum. The real queue can
        // only match or exceed it, never beat it.
        const simulated = simulateShard(durations, workerCount).makespan;
        const optimum = branchAndBound(durations, workerCount).makespan;
        expect(simulated).toBeGreaterThanOrEqual(optimum);
      }
    });
  });

  describe('simulateRun (whole sharded run)', () => {
    it('handles an empty run', () => {
      expect(simulateRun([], [], 2)).toEqual({ shards: [], makespan: 0 });
    });

    it('the run finishes with its slowest shard', () => {
      const durations = [10, 4, 6, 2, 8];
      const assignment = branchAndBound(durations, 3).assignment;
      const run = simulateRun(durations, assignment, 2);
      const slowest = Math.max(...run.shards.map((s) => s.makespan));
      expect(run.makespan).toBe(slowest);
    });

    it('equals the scheduler makespan when each shard has a single worker', () => {
      // With one worker a shard runs sequentially, so its wall time is its
      // total load — exactly what the scheduler assumed.
      const random = mulberry32(88);
      for (let i = 0; i < 100; i++) {
        const taskCount = randomInt(random, 0, 15);
        const shardCount = randomInt(random, 1, 5);
        const durations = Array.from({ length: taskCount }, () =>
          randomInt(random, 1, 100),
        );
        const scheduled = lpt(durations, shardCount);
        const run = simulateRun(durations, scheduled.assignment, 1);
        expect(run.makespan).toBe(scheduled.makespan);
      }
    });

    it('extra workers never make a run slower (and never beat the scheduler)', () => {
      const random = mulberry32(64);
      for (let i = 0; i < 100; i++) {
        const taskCount = randomInt(random, 1, 15);
        const shardCount = randomInt(random, 1, 5);
        const durations = Array.from({ length: taskCount }, () =>
          randomInt(random, 1, 100),
        );
        const scheduled = lpt(durations, shardCount);
        const oneWorker = simulateRun(durations, scheduled.assignment, 1).makespan;
        const manyWorkers = simulateRun(durations, scheduled.assignment, 4).makespan;
        // More parallelism inside a shard can only help.
        expect(manyWorkers).toBeLessThanOrEqual(oneWorker);
        // ...and a single worker reproduces the scheduler's sequential makespan.
        expect(oneWorker).toBe(scheduled.makespan);
      }
    });
  });

  describe('physical invariants (property test)', () => {
    it('conserves work and respects the basic time bounds', () => {
      const random = mulberry32(31);
      for (let i = 0; i < 200; i++) {
        const taskCount = randomInt(random, 0, 20);
        const workerCount = randomInt(random, 1, 6);
        const durations = Array.from({ length: taskCount }, () =>
          randomInt(random, 1, 400),
        );
        const { assignment, loads, makespan } = simulateShard(durations, workerCount);

        const total = durations.reduce((acc, d) => acc + d, 0);
        const longest = durations.length ? Math.max(...durations) : 0;

        // Work is conserved: no time is created or lost.
        expect(loads.reduce((acc, l) => acc + l, 0)).toBe(total);
        // Wall time sits between "perfect split" and "everything on one worker".
        expect(makespan).toBeGreaterThanOrEqual(total / workerCount);
        expect(makespan).toBeGreaterThanOrEqual(longest);
        expect(makespan).toBeLessThanOrEqual(total);
        // Every task runs exactly once.
        expect(assignment.flat().sort((a, b) => a - b)).toEqual(
          Array.from({ length: taskCount }, (_, k) => k),
        );
      }
    });
  });
});
