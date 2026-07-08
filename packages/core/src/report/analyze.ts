import type { AtomicTask } from '../types/domain';
import { parseReport } from './parser';
import { normalize, durationsOf } from './normalizer';
import { parseCypressReport, normalizeCypress } from './cypress';
import { classify } from './classifier';
import type { ClassifyOptions } from './classifier';
import { recommend } from '../recommender/recommend';
import type { RecommendOptions, RecommendationResult } from '../recommender/recommend';

/** Test report format the input is in. */
export type ReportFormat = 'playwright' | 'cypress';

export interface AnalyzeOptions extends RecommendOptions {
  /** Report format (default: 'playwright'). */
  format?: ReportFormat;
  /** Classifier configuration (rules, default block). */
  classify?: ClassifyOptions;
}

/** Turn a raw report into tasks, choosing the reader by format. */
function readTasks(input: string | unknown, format: ReportFormat): AtomicTask[] {
  return format === 'cypress'
    ? normalizeCypress(parseCypressReport(input))
    : normalize(parseReport(input));
}

export interface AnalysisResult {
  /** Normalized and classified tasks extracted from the report. */
  tasks: AtomicTask[];
  /** The sharding recommendation over those tasks' durations. */
  recommendation: RecommendationResult;
}

/**
 * The whole pipeline in one call: parse a Playwright JSON report, normalize it
 * into tasks, classify them into blocks, and recommend a sharding strategy.
 * This is the single entry point the web, CLI and API adapters build on.
 */
export function analyze(input: string | unknown, options: AnalyzeOptions = {}): AnalysisResult {
  const tasks = classify(readTasks(input, options.format ?? 'playwright'), options.classify);
  const recommendation = recommend(durationsOf(tasks), options);
  return { tasks, recommendation };
}
