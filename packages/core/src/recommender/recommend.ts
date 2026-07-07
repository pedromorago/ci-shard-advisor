import { buildFrontier, evaluateConfig } from './frontier';
import type { ConfigPoint, FrontierOptions } from './frontier';
import { findElbow } from './elbow';

/** How the recommended configuration compares to the team's current one. */
export interface Savings {
  /** current feedback time - recommended feedback time. Positive = faster. */
  timeSavedMs: number;
  /** recommended cost - current cost. Positive = more expensive. */
  costDeltaMs: number;
}

export interface RecommendOptions extends FrontierOptions {
  /** The team's current shard count, to compare the recommendation against. */
  currentShardCount?: number;
}

export interface RecommendationResult {
  /** The full cost/time curve that was searched. */
  frontier: ConfigPoint[];
  /** The recommended configuration (the knee of the frontier). */
  recommended: ConfigPoint;
  /** The current configuration, when a currentShardCount was provided. */
  current?: ConfigPoint;
  /** Recommended-vs-current deltas, when a currentShardCount was provided. */
  savings?: Savings;
}

/**
 * Top-level advice: build the frontier, pick its knee as the recommendation,
 * and — if the caller passes their current shard count — quantify how much
 * time and money moving to the recommendation would save (or cost).
 */
export function recommend(
  durations: readonly number[],
  options: RecommendOptions = {},
): RecommendationResult {
  const frontier = buildFrontier(durations, options);
  const recommended = findElbow(frontier);

  if (options.currentShardCount == null) {
    return { frontier, recommended };
  }
  if (!Number.isInteger(options.currentShardCount) || options.currentShardCount < 1) {
    throw new RangeError(
      `currentShardCount must be an integer >= 1, got ${options.currentShardCount}`,
    );
  }

  // Evaluate the current config directly so it works even beyond maxShards.
  const current = evaluateConfig(durations, options.currentShardCount, options);
  const savings: Savings = {
    timeSavedMs: current.feedbackTimeMs - recommended.feedbackTimeMs,
    costDeltaMs: recommended.costMs - current.costMs,
  };
  return { frontier, recommended, current, savings };
}
