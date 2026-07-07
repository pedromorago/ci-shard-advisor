import type { AtomicTask } from '../types/domain';
import { parseReport } from './parser';
import { normalize, durationsOf } from './normalizer';
import { classify } from './classifier';
import type { ClassifyOptions } from './classifier';
import { recommend } from '../recommender/recommend';
import type { RecommendOptions, RecommendationResult } from '../recommender/recommend';

export interface AnalyzeOptions extends RecommendOptions {
  /** Classifier configuration (rules, default block). */
  classify?: ClassifyOptions;
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
  const report = parseReport(input);
  const tasks = classify(normalize(report), options.classify);
  const recommendation = recommend(durationsOf(tasks), options);
  return { tasks, recommendation };
}
