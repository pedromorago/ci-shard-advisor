import { analyze } from '@ci-shard-advisor/core';
import type { AnalyzeOptions, AnalysisResult } from '@ci-shard-advisor/core';
import demoReport from './demo-report.json';

/**
 * Analysis options tuned for the browser. maxShards is capped and the solver
 * gets a time budget so a large real report can never hang the tab — the
 * branch-and-bound falls back to its LPT incumbent when the budget runs out.
 */
const BASE_OPTIONS: AnalyzeOptions = {
  maxShards: 12,
  startupOverheadMs: 30000,
  solve: { timeBudgetMs: 100 },
};

/** The preloaded demo analysis, including a "current config" to compare against. */
export function demoAnalysis(): AnalysisResult {
  return analyze(demoReport, { ...BASE_OPTIONS, currentShardCount: 6 });
}

/** Analyze a report supplied by the user (raw JSON text). */
export function analyzeText(jsonText: string): AnalysisResult {
  return analyze(jsonText, BASE_OPTIONS);
}
