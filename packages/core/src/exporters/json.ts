import type { AnalysisResult } from '../report/analyze';
import { summarize } from './summary';
import type { AnalysisSummary } from './summary';

/**
 * Export the analysis as a stable, machine-readable summary object — the shape
 * an API or a saved artifact would serialize. Times stay in raw milliseconds;
 * formatting is left to the human-facing exporters.
 */
export function toSummaryObject(analysis: AnalysisResult): AnalysisSummary {
  return summarize(analysis);
}

/** Export the analysis as a pretty-printed JSON string. */
export function toJson(analysis: AnalysisResult): string {
  return JSON.stringify(summarize(analysis), null, 2);
}
