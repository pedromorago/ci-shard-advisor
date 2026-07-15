import type { AnalysisResult } from '../report/analyze';
import type { ConfigPoint } from '../recommender/frontier';
import type { Savings } from '../recommender/recommend';

/** Per-block aggregate: how many tests it holds and their total duration. */
export interface BlockSummary {
  block: string;
  tests: number;
  durationMs: number;
}

/**
 * The presentation-ready model every exporter renders from. Computed once so
 * the JSON, text and Markdown outputs stay consistent with each other.
 */
export interface AnalysisSummary {
  totalTests: number;
  totalDurationMs: number;
  blocks: BlockSummary[];
  recommended: ConfigPoint;
  current?: ConfigPoint;
  savings?: Savings;
  frontier: ConfigPoint[];
}

/** Aggregate an analysis into the shared summary model. */
export function summarize(analysis: AnalysisResult): AnalysisSummary {
  const { tasks, recommendation } = analysis;

  const byBlock = new Map<string, BlockSummary>();
  for (const task of tasks) {
    const block = task.block ?? 'unclassified';
    const entry = byBlock.get(block) ?? { block, tests: 0, durationMs: 0 };
    entry.tests += 1;
    entry.durationMs += task.durationMs;
    byBlock.set(block, entry);
  }
  const blocks = [...byBlock.values()].sort(
    (a, b) => b.durationMs - a.durationMs || a.block.localeCompare(b.block),
  );

  const summary: AnalysisSummary = {
    totalTests: tasks.length,
    totalDurationMs: tasks.reduce((sum, task) => sum + task.durationMs, 0),
    blocks,
    recommended: recommendation.recommended,
    frontier: recommendation.frontier,
  };
  if (recommendation.current) summary.current = recommendation.current;
  if (recommendation.savings) summary.savings = recommendation.savings;
  return summary;
}

/**
 * Format a millisecond duration for humans, deterministically (no locale, no
 * clock): sub-minute values as seconds with one decimal, longer ones as
 * "Nm Ns". Snapshot-stable across machines.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) {
    const seconds = totalSeconds.toFixed(1);
    // 59.96s would render as "60.0s" — carry it into the minute form instead.
    if (seconds !== '60.0') return `${seconds}s`;
  }
  // Round to whole seconds BEFORE splitting so 119.6s is "2m 0s", never "1m 60s".
  const rounded = Math.round(totalSeconds);
  return `${Math.floor(rounded / 60)}m ${rounded % 60}s`;
}

/** Format a signed delta with an explicit + or - sign (for savings lines). */
export function formatSignedDuration(ms: number): string {
  const sign = ms < 0 ? '-' : '+';
  return `${sign}${formatDuration(Math.abs(ms))}`;
}
