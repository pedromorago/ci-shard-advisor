import type { ConfigPoint } from './frontier';

/**
 * Pick the "elbow" (a.k.a. knee) of the cost/time frontier: the configuration
 * with the best trade-off, past which extra shards buy little time for a lot
 * of cost.
 *
 * Method: plot each point as (feedbackTime, cost), normalize both axes to
 * [0, 1] so neither magnitude dominates, and take the point that sits farthest
 * from the straight chord joining the two extreme configurations. That point
 * of maximum curvature is the knee.
 *
 * Ties and flat curves resolve to the smallest shard count (the cheaper of two
 * equivalent options). Frontiers with one or two points have no interior knee,
 * so the first (cheapest) point is returned.
 */
export function findElbow(frontier: readonly ConfigPoint[]): ConfigPoint {
  if (frontier.length === 0) {
    throw new RangeError('frontier must not be empty');
  }
  if (frontier.length <= 2) {
    return frontier[0];
  }

  const times = frontier.map((p) => p.feedbackTimeMs);
  const costs = frontier.map((p) => p.costMs);
  const timeMin = Math.min(...times);
  const costMin = Math.min(...costs);
  // Avoid dividing by zero when an axis is flat: a zero range normalizes to 0.
  const timeRange = Math.max(...times) - timeMin || 1;
  const costRange = Math.max(...costs) - costMin || 1;

  const normalized = frontier.map((p) => ({
    x: (p.feedbackTimeMs - timeMin) / timeRange,
    y: (p.costMs - costMin) / costRange,
  }));

  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const chordLength = Math.hypot(dx, dy) || 1;

  let bestIndex = 0;
  let bestDistance = -1;
  for (let i = 0; i < normalized.length; i++) {
    const { x, y } = normalized[i];
    // Perpendicular distance from the point to the chord first -> last.
    const distance =
      Math.abs(dy * x - dx * y + last.x * first.y - last.y * first.x) / chordLength;
    if (distance > bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return frontier[bestIndex];
}
