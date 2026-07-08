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

/**
 * How to pick the recommended configuration:
 * - `'knee'` (default): the balanced sweet spot — no price needed.
 * - `'fastest'`: minimize feedback time.
 * - `'cheapest'`: minimize billed cost.
 * - a number: minimize `cost + value × feedbackTime`, where `value` is how many
 *   units of billed cost one unit of feedback time is worth to you (0 = cost
 *   only, higher = speed matters more). For when you do know your trade-off.
 */
export type Priority = 'knee' | 'fastest' | 'cheapest' | number;

export interface RecommendOptions extends FrontierOptions {
  /** The team's current shard count, to compare the recommendation against. */
  currentShardCount?: number;
  /** Recommendation criterion. Defaults to the balanced knee. */
  priority?: Priority;
}

/** Pick the recommended point from the frontier according to `priority`. */
function chooseRecommendation(frontier: ConfigPoint[], priority: Priority = 'knee'): ConfigPoint {
  if (priority === 'knee') return findElbow(frontier);

  let score: (point: ConfigPoint) => number;
  if (priority === 'fastest') {
    score = (point) => point.feedbackTimeMs;
  } else if (priority === 'cheapest') {
    score = (point) => point.costMs;
  } else {
    if (!Number.isFinite(priority) || priority < 0) {
      throw new RangeError(`priority weight must be a finite number >= 0, got ${priority}`);
    }
    score = (point) => point.costMs + priority * point.feedbackTimeMs;
  }

  // The frontier is ordered by ascending shard count, so a strict `<` keeps the
  // fewest shards on ties.
  let best = frontier[0];
  for (const point of frontier) {
    if (score(point) < score(best)) best = point;
  }
  return best;
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
  const recommended = chooseRecommendation(frontier, options.priority);

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
