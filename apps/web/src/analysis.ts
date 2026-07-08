import { analyze } from '@ci-shard-advisor/core';
import type { AnalyzeOptions, AnalysisResult } from '@ci-shard-advisor/core';
import demoReport from './demo-report.json';

/** The knobs the user controls — none of these come from the report itself. */
export interface AnalysisSettings {
  /** Per-shard CI startup overhead, in seconds (machine boot, install, …). */
  startupOverheadSec: number;
  /** Workers running in parallel inside each shard. */
  workersPerShard: number;
  /** The team's current shard (container) count. */
  currentShardCount: number;
  /** What the platform bills per shard-minute (e.g. 0.01 $/min). */
  costRatePerMin: number;
}

export const DEFAULT_SETTINGS: AnalysisSettings = {
  startupOverheadSec: 30,
  workersPerShard: 1,
  currentShardCount: 6,
  costRatePerMin: 0.01,
};

/** Largest shard count to evaluate — always includes the current config. */
export function maxShardsFor(settings: AnalysisSettings): number {
  return Math.max(16, settings.currentShardCount);
}

function toOptions(settings: AnalysisSettings): AnalyzeOptions {
  return {
    maxShards: maxShardsFor(settings),
    startupOverheadMs: settings.startupOverheadSec * 1000,
    workersPerShard: settings.workersPerShard,
    currentShardCount: settings.currentShardCount,
    // Cap the solver so a large real report never hangs the tab.
    solve: { timeBudgetMs: 100 },
  };
}

/** The raw report a user can supply (parsed object or raw text). */
export type ReportInput = string | unknown;

/** The preloaded demo report (a Playwright run). */
export const DEMO_REPORT: ReportInput = demoReport;

/** Analyze any report with the given settings. Format is auto-detected. */
export function analyzeReport(input: ReportInput, settings: AnalysisSettings): AnalysisResult {
  return analyze(input, toOptions(settings));
}

/** Format billed machine time (ms) as money at the given per-minute rate. */
export function formatMoney(costMs: number, ratePerMin: number): string {
  const dollars = (costMs / 60_000) * ratePerMin;
  return `$${dollars.toFixed(2)}`;
}
