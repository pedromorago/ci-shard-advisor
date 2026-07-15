import type { AtomicTask } from '../types/domain';
import { parseReport } from './parser';
import { normalize, durationsOf } from './normalizer';
import { parseCypressReport, normalizeCypress } from './cypress';
import { parseMochawesomeReport, normalizeMochawesome } from './mochawesome';
import { parseJUnitReport, normalizeJUnit } from './junit';
import { classify } from './classifier';
import type { ClassifyOptions } from './classifier';
import { recommend } from '../recommender/recommend';
import type { RecommendOptions, RecommendationResult } from '../recommender/recommend';

/** Test report format the input is in. */
export type ReportFormat = 'playwright' | 'cypress' | 'mochawesome' | 'junit';

export interface AnalyzeOptions extends RecommendOptions {
  /** Report format. Defaults to 'auto' (detected from the report shape). */
  format?: ReportFormat | 'auto';
  /** Classifier configuration (rules, default block). */
  classify?: ClassifyOptions;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Detect the report format from its shape: XML text is JUnit, a top-level
 * `runs` array is a Cypress run result, `results` is a mochawesome report,
 * `suites` is a Playwright report.
 */
export function detectFormat(input: string | unknown): ReportFormat {
  let raw: unknown = input;
  if (typeof input === 'string') {
    if (input.trimStart().startsWith('<')) return 'junit';
    try {
      raw = JSON.parse(input);
    } catch {
      return 'playwright';
    }
  }
  if (isRecord(raw)) {
    if (Array.isArray(raw.runs)) return 'cypress';
    if (Array.isArray(raw.results)) return 'mochawesome';
  }
  return 'playwright';
}

/** Turn a raw report into tasks, choosing the reader by format. */
function readTasks(input: string | unknown, format: ReportFormat): AtomicTask[] {
  switch (format) {
    case 'cypress':
      return normalizeCypress(parseCypressReport(input));
    case 'mochawesome':
      return normalizeMochawesome(parseMochawesomeReport(input));
    case 'junit':
      return normalizeJUnit(parseJUnitReport(input));
    default:
      return normalize(parseReport(input));
  }
}

/**
 * Read a single report into tasks, detecting the format (or using a forced one).
 * The public entry point the advisor uses per report file.
 */
export function readReport(input: string | unknown, format: ReportFormat | 'auto' = 'auto'): AtomicTask[] {
  return readTasks(input, format === 'auto' ? detectFormat(input) : format);
}

export interface AnalysisResult {
  /** Normalized and classified tasks extracted from the report. */
  tasks: AtomicTask[];
  /** The sharding recommendation over those tasks' durations. */
  recommendation: RecommendationResult;
}

/**
 * The whole pipeline in one call: parse a test report (auto-detected: Cypress
 * Module API, mochawesome, Playwright or JUnit), normalize it into tasks,
 * classify them into blocks, and recommend a sharding strategy. Kept as the
 * internal v1 layer; adapters consume `advise()`.
 */
export function analyze(input: string | unknown, options: AnalyzeOptions = {}): AnalysisResult {
  const requested = options.format ?? 'auto';
  const format = requested === 'auto' ? detectFormat(input) : requested;
  const tasks = classify(readTasks(input, format), options.classify);
  const recommendation = recommend(durationsOf(tasks), options);
  return { tasks, recommendation };
}
