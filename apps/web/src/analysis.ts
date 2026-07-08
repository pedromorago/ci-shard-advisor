import { analyze } from '@ci-shard-advisor/core';
import type { AnalyzeOptions, AnalysisResult, Priority } from '@ci-shard-advisor/core';
import demoReport from './demo-report.json';

/** The knobs the user controls — none of these come from the report itself. */
export interface AnalysisSettings {
  /** Per-shard CI startup overhead, in seconds (machine boot, install, …). */
  startupOverheadSec: number;
  /** Workers running in parallel inside each shard. */
  workersPerShard: number;
  /** The team's current shard count, for the comparison. */
  currentShardCount: number;
  /** How to pick the recommendation (defaults to the balanced knee). */
  priority: Priority;
}

export const DEFAULT_SETTINGS: AnalysisSettings = {
  startupOverheadSec: 30,
  workersPerShard: 1,
  currentShardCount: 6,
  priority: 'knee',
};

function toOptions(settings: AnalysisSettings): AnalyzeOptions {
  return {
    maxShards: 12,
    startupOverheadMs: settings.startupOverheadSec * 1000,
    workersPerShard: settings.workersPerShard,
    currentShardCount: settings.currentShardCount,
    priority: settings.priority,
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
