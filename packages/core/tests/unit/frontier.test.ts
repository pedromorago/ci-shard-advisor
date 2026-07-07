import { describe, expect, it } from 'vitest';
import { buildFrontier } from '../../src/recommender/frontier';
import { mulberry32, randomInt } from '../helpers/random';

describe('buildFrontier', () => {
  describe('input validation', () => {
    it('rejects bad durations, worker counts and options', () => {
      expect(() => buildFrontier([Number.NaN])).toThrow(RangeError);
      expect(() => buildFrontier([1], { maxShards: 0 })).toThrow(RangeError);
      expect(() => buildFrontier([1], { maxShards: 2.5 })).toThrow(RangeError);
      expect(() => buildFrontier([1], { workersPerShard: 0 })).toThrow(RangeError);
      expect(() => buildFrontier([1], { startupOverheadMs: -1 })).toThrow(RangeError);
    });
  });

  describe('a worked example', () => {
    it('trades time for cost as shards grow', () => {
      const frontier = buildFrontier([10, 10, 10, 10], {
        maxShards: 4,
        startupOverheadMs: 5,
      });
      expect(frontier).toHaveLength(4);
      // 1 shard: everything sequential.
      expect(frontier[0]).toMatchObject({ runTimeMs: 40, feedbackTimeMs: 45, costMs: 45 });
      // 4 shards: fully parallel, but four machine startups billed.
      expect(frontier[3]).toMatchObject({ runTimeMs: 10, feedbackTimeMs: 15, costMs: 60 });
    });
  });

  describe('edge cases', () => {
    it('returns a single point for an empty suite', () => {
      const frontier = buildFrontier([], { startupOverheadMs: 7 });
      expect(frontier).toHaveLength(1);
      expect(frontier[0]).toMatchObject({ shardCount: 1, runTimeMs: 0, costMs: 7 });
    });

    it('defaults maxShards to the task count', () => {
      expect(buildFrontier([3, 3, 3])).toHaveLength(3);
    });
  });

  describe('trade-off invariants with one worker per shard (property test)', () => {
    it('time never rises and billed cost is exactly work plus startups', () => {
      const random = mulberry32(202);
      for (let i = 0; i < 100; i++) {
        const taskCount = randomInt(random, 1, 12);
        const overhead = randomInt(random, 0, 50);
        const durations = Array.from({ length: taskCount }, () =>
          randomInt(random, 1, 200),
        );
        const total = durations.reduce((acc, d) => acc + d, 0);
        const frontier = buildFrontier(durations, { startupOverheadMs: overhead });

        for (let s = 0; s < frontier.length; s++) {
          // With one worker, a shard is sequential, so cost is provably
          // total work plus one startup per shard.
          expect(frontier[s].costMs).toBe(total + frontier[s].shardCount * overhead);
          if (s > 0) {
            // More shards can only speed the run up...
            expect(frontier[s].runTimeMs).toBeLessThanOrEqual(frontier[s - 1].runTimeMs);
            // ...while never costing less than a smaller split.
            expect(frontier[s].costMs).toBeGreaterThanOrEqual(frontier[s - 1].costMs);
          }
        }
      }
    });
  });
});
