import { describe, expect, it } from 'vitest';
import { bruteForceMakespan } from '../helpers/brute-force';

// An oracle we do not trust is useless. Before using it as the reference for
// the solver, we pin it against instances whose optimum we can reason about
// by hand.
describe('bruteForceMakespan (test oracle)', () => {
  it('returns 0 for an empty task list', () => {
    expect(bruteForceMakespan([], 3)).toBe(0);
  });

  it('sums everything on a single shard', () => {
    expect(bruteForceMakespan([10, 20, 5], 1)).toBe(35);
  });

  it('drops to the longest task when shards outnumber tasks', () => {
    expect(bruteForceMakespan([10, 20, 5], 5)).toBe(20);
  });

  it('finds the optimal split of [10, 10, 5] across 2 shards', () => {
    // {10,5} and {10} -> 15 is optimal; no split does better.
    expect(bruteForceMakespan([10, 10, 5], 2)).toBe(15);
  });

  it('finds a perfectly balanced split when one exists', () => {
    // {8,2} and {6,4} both sum to 10.
    expect(bruteForceMakespan([8, 6, 4, 2], 2)).toBe(10);
  });
});
