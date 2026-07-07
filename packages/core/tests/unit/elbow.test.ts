import { describe, expect, it } from 'vitest';
import { findElbow } from '../../src/recommender/elbow';
import { buildFrontier } from '../../src/recommender/frontier';
import type { ConfigPoint } from '../../src/recommender/frontier';

/** Build a bare ConfigPoint carrying only the axes the elbow finder reads. */
function point(shardCount: number, feedbackTimeMs: number, costMs: number): ConfigPoint {
  return { shardCount, workersPerShard: 1, runTimeMs: feedbackTimeMs, feedbackTimeMs, costMs, optimal: true };
}

describe('findElbow', () => {
  describe('degenerate frontiers', () => {
    it('throws on an empty frontier', () => {
      expect(() => findElbow([])).toThrow(RangeError);
    });

    it('returns the only point when there is one', () => {
      expect(findElbow([point(1, 100, 10)]).shardCount).toBe(1);
    });

    it('returns the cheapest point when there are only two (no interior knee)', () => {
      expect(findElbow([point(1, 100, 10), point(2, 50, 20)]).shardCount).toBe(1);
    });

    it('returns the cheapest point when the frontier is a straight line', () => {
      const line = [point(1, 10, 0), point(2, 5, 5), point(3, 0, 10)];
      expect(findElbow(line).shardCount).toBe(1);
    });
  });

  describe('finds the point of maximum curvature', () => {
    it('picks the corner of an L-shaped frontier', () => {
      // Chord runs from (10,0) to (0,10); the middle point (0,0) is farthest.
      const elbow = [point(1, 10, 0), point(2, 0, 0), point(3, 0, 10)];
      expect(findElbow(elbow).shardCount).toBe(2);
    });

    it('picks the knee where the time gains flatten out', () => {
      // Time plunges 100 -> 25, then barely moves while cost keeps climbing.
      const frontier = [
        point(1, 100, 10),
        point(2, 25, 20), // knee: most of the speed-up, still cheap
        point(3, 20, 35),
        point(4, 18, 55),
        point(5, 17, 80),
      ];
      expect(findElbow(frontier).shardCount).toBe(2);
    });
  });

  describe('scale invariance (metamorphic property)', () => {
    it('does not move the elbow when one axis is rescaled', () => {
      const frontier = buildFrontier([40, 30, 20, 20, 10, 10, 5, 5], {
        maxShards: 8,
        startupOverheadMs: 20,
      });
      const baseline = findElbow(frontier).shardCount;

      // Normalization means multiplying an axis by a constant cannot change
      // which point is the knee.
      const costScaled = frontier.map((p) => ({ ...p, costMs: p.costMs * 1000 }));
      const timeScaled = frontier.map((p) => ({
        ...p,
        feedbackTimeMs: p.feedbackTimeMs * 60,
      }));
      expect(findElbow(costScaled).shardCount).toBe(baseline);
      expect(findElbow(timeScaled).shardCount).toBe(baseline);
    });
  });
});
