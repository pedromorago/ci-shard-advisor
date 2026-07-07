import { describe, expect, it } from 'vitest';
import { branchAndBound } from '../../src/scheduler/branch-and-bound';
import { lpt } from '../../src/scheduler/lpt';
import { lowerBound } from '../../src/scheduler/bounds';
import { mulberry32, randomInt } from '../helpers/random';

describe('branchAndBound', () => {
  describe('input validation', () => {
    it('rejects invalid shard counts', () => {
      expect(() => branchAndBound([1], 0)).toThrow(RangeError);
      expect(() => branchAndBound([1], -1)).toThrow(RangeError);
      expect(() => branchAndBound([1], 2.5)).toThrow(RangeError);
    });

    it('rejects negative or non-finite durations', () => {
      expect(() => branchAndBound([-5], 2)).toThrow(RangeError);
      expect(() => branchAndBound([Number.NaN], 2)).toThrow(RangeError);
    });
  });

  describe('trivial cases are certified optimal', () => {
    it('handles an empty task list', () => {
      const result = branchAndBound([], 3);
      expect(result.makespan).toBe(0);
      expect(result.optimal).toBe(true);
      expect(result.gap).toBe(0);
    });

    it('puts everything on one shard when shardCount is 1', () => {
      const result = branchAndBound([10, 20, 5], 1);
      expect(result.makespan).toBe(35);
      expect(result.optimal).toBe(true);
    });

    it('is optimal when shards outnumber tasks', () => {
      const result = branchAndBound([10, 20, 5], 5);
      expect(result.makespan).toBe(20);
      expect(result.optimal).toBe(true);
      expect(result.gap).toBe(0);
    });
  });

  describe('invariants that must always hold', () => {
    it('never does worse than LPT and never beats the lower bound', () => {
      const random = mulberry32(123);
      for (let i = 0; i < 100; i++) {
        const taskCount = randomInt(random, 1, 12);
        const shardCount = randomInt(random, 1, 5);
        const durations = Array.from({ length: taskCount }, () =>
          randomInt(random, 1, 300),
        );
        const result = branchAndBound(durations, shardCount);
        expect(result.makespan).toBeLessThanOrEqual(lpt(durations, shardCount).makespan);
        expect(result.makespan).toBeGreaterThanOrEqual(lowerBound(durations, shardCount));
      }
    });

    it('assigns every task exactly once', () => {
      const durations = [7, 3, 9, 1, 4, 4, 8];
      const { assignment } = branchAndBound(durations, 3);
      const seen = assignment.flat().sort((a, b) => a - b);
      expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
  });
});
