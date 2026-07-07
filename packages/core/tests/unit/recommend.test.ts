import { describe, expect, it } from 'vitest';
import { recommend } from '../../src/recommender/recommend';

describe('recommend', () => {
  it('returns just the frontier and recommendation with no current config', () => {
    const result = recommend([10, 10, 10, 10], { maxShards: 4, startupOverheadMs: 5 });
    expect(result.frontier).toHaveLength(4);
    expect(result.frontier).toContainEqual(result.recommended);
    expect(result.current).toBeUndefined();
    expect(result.savings).toBeUndefined();
  });

  it('quantifies the savings of the recommendation over the current config', () => {
    // Frontier feedback/cost: s1 (45,45) s2 (25,50) s3 (25,55) s4 (15,60).
    // The knee is s2; coming from a single shard we save time for a little cost.
    const result = recommend([10, 10, 10, 10], {
      maxShards: 4,
      startupOverheadMs: 5,
      currentShardCount: 1,
    });
    expect(result.recommended.shardCount).toBe(2);
    expect(result.current?.shardCount).toBe(1);
    expect(result.savings).toEqual({ timeSavedMs: 20, costDeltaMs: 5 });
  });

  it('reports zero savings when already on the recommended config', () => {
    const result = recommend([10, 10, 10, 10], {
      maxShards: 4,
      startupOverheadMs: 5,
      currentShardCount: 2,
    });
    expect(result.current?.shardCount).toBe(result.recommended.shardCount);
    expect(result.savings).toEqual({ timeSavedMs: 0, costDeltaMs: 0 });
  });

  it('handles a current config that over-shards past the knee', () => {
    // Coming from 4 shards, the recommendation is slower but cheaper.
    const result = recommend([10, 10, 10, 10], {
      maxShards: 4,
      startupOverheadMs: 5,
      currentShardCount: 4,
    });
    expect(result.savings!.timeSavedMs).toBeLessThan(0); // recommendation is slower
    expect(result.savings!.costDeltaMs).toBeLessThan(0); // ...but cheaper
  });

  it('evaluates a current config beyond maxShards', () => {
    const result = recommend([10, 10, 10, 10], {
      maxShards: 2,
      currentShardCount: 4,
    });
    expect(result.current?.shardCount).toBe(4);
  });

  it('rejects an invalid current shard count', () => {
    expect(() => recommend([1, 2, 3], { currentShardCount: 0 })).toThrow(RangeError);
    expect(() => recommend([1, 2, 3], { currentShardCount: 1.5 })).toThrow(RangeError);
  });
});
