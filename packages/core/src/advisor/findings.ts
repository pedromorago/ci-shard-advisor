import { formatDuration } from '../exporters/summary';
import type { ConfigPoint } from '../recommender/frontier';
import type { AtomicTask } from '../types/domain';
import type { CostModel, Findings, MeasuredCurrent } from './types';

/** Below this relative feedback spread, more shards no longer help. */
const NEGLIGIBLE = 0.02;

/** Format billed ms as money, or null when no price is set. */
function money(costMs: number, cost: CostModel): string | null {
  if (cost.pricePerMinute === undefined) return null;
  const value = (costMs / 60_000) * cost.pricePerMinute;
  return `${cost.currency ?? '€'}${value.toFixed(2)}`;
}

/** The smallest shard count that already reaches (within ε) the fastest feedback. */
function saturationPoint(frontier: ConfigPoint[]): number {
  const minFeedback = Math.min(...frontier.map((p) => p.feedbackTimeMs));
  const reached = frontier.find((p) => p.feedbackTimeMs <= minFeedback * (1 + NEGLIGIBLE));
  return reached ? reached.shardCount : frontier.length;
}

/**
 * The advisor's voice (spec §5.5): worded findings and the flaky breakdown.
 * Sentences are written here in the core so every adapter stays consistent.
 */
export function computeFindings(
  frontier: ConfigPoint[],
  current: MeasuredCurrent,
  tasks: AtomicTask[],
  cost: CostModel,
): Findings {
  const warnings: string[] = [];
  const saturationN = saturationPoint(frontier);
  const longest = tasks.reduce<AtomicTask | undefined>(
    (best, task) => (!best || task.durationMs > best.durationMs ? task : best),
    undefined,
  );

  // Over-fragmentation: more shards than the point where feedback plateaus.
  if (current.shardCount > saturationN) {
    const plateau = frontier[saturationN - 1];
    const costPct = plateau.costMs > 0 ? Math.round(((current.costMs - plateau.costMs) / plateau.costMs) * 100) : 0;
    const timeSaved = current.feedbackTimeMs - plateau.feedbackTimeMs;
    const gain = timeSaved > 0 ? `−${formatDuration(timeSaved)}` : 'no faster';
    warnings.push(
      `You run ${current.shardCount} shards, but past ${saturationN} you only pay more: +${costPct}% cost for ${gain}.`,
    );
  }

  // Under-fragmentation: room to speed up by adding shards.
  if (current.shardCount < saturationN) {
    const target = frontier[saturationN - 1];
    const pct =
      current.feedbackTimeMs > 0
        ? Math.round(((current.feedbackTimeMs - target.feedbackTimeMs) / current.feedbackTimeMs) * 100)
        : 0;
    if (pct >= 5) {
      const costStr = money(target.costMs - current.costMs, cost) ?? formatDuration(target.costMs - current.costMs);
      warnings.push(`With ${saturationN} shards you would cut the wait by ${pct}% for +${costStr} per run.`);
    }
  }

  // Floor / bottleneck: a single test gates the wait past the plateau.
  if (saturationN < frontier.length && longest && longest.durationMs > 0) {
    warnings.push(
      `Past ${saturationN} shards the wait stops dropping: '${longest.file || longest.title}' (${formatDuration(longest.durationMs)}) sets the floor. Consider splitting it.`,
    );
  }

  // Imbalance (measured mode only): paying for idle machines.
  if (current.measured && current.imbalanceMs > 0) {
    warnings.push(
      `Your fastest shard finishes ${formatDuration(current.imbalanceMs)} before the slowest — you are paying for idle machines.`,
    );
  }

  // Flaky: retried tests and the machine time they burned.
  const flaky = tasks
    .filter((task) => task.retries > 0)
    .map((task) => ({ id: task.id, title: task.title, retries: task.retries, wastedMs: task.wastedMs ?? 0 }));
  const totalWasted = flaky.reduce((sum, f) => sum + f.wastedMs, 0);
  if (flaky.length > 0 && totalWasted > 0) {
    warnings.push(
      `${flaky.length} flaky test${flaky.length > 1 ? 's' : ''} wasted ${formatDuration(totalWasted)} of machine time in retries this run.`,
    );
  }

  return { warnings, flaky };
}
