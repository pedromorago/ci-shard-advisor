import { parseArgs } from 'node:util';
import { analyze, toText, toJson, toMarkdown, formatDuration } from '@ci-shard-advisor/core';
import type { AnalyzeOptions } from '@ci-shard-advisor/core';
import { parseDuration, parseIntOption } from './duration';

/** Injected I/O so the CLI is testable without a process or the filesystem. */
export interface CliIO {
  readFile: (path: string) => string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

const USAGE = `ci-shard-advisor <report.json> [options]

Analyze a Playwright JSON report and recommend a CI sharding strategy.

Options:
  --format <text|json|markdown>  Output format (default: text)
  --input-format <playwright|cypress>  Report format (default: playwright)
  --shards <n>                   Your current shard count (enables comparison)
  --workers <n>                  Workers per shard (default: 1)
  --overhead <duration>          Per-shard startup overhead (e.g. 30s, default: 0)
  --max-shards <n>               Largest shard count to evaluate

Quality gate (sets a non-zero exit code on failure):
  --max-feedback <duration>      Fail if the best feedback time exceeds this budget
  --max-cost-waste <pct>         Fail if your current config wastes more than pct%
                                 cost versus the recommendation (needs --shards)

  -h, --help                     Show this help`;

const FORMATTERS = { text: toText, json: toJson, markdown: toMarkdown };

/**
 * Run the CLI. Returns the process exit code: 0 on success, 1 when a quality
 * gate fails, 2 on a usage or input error.
 */
export function run(argv: string[], io: CliIO): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        format: { type: 'string', default: 'text' },
        'input-format': { type: 'string' },
        shards: { type: 'string' },
        workers: { type: 'string' },
        overhead: { type: 'string' },
        'max-shards': { type: 'string' },
        'max-feedback': { type: 'string' },
        'max-cost-waste': { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (error) {
    io.stderr(`error: ${(error as Error).message}`);
    io.stderr(USAGE);
    return 2;
  }

  const { values, positionals } = parsed;
  if (values.help) {
    io.stdout(USAGE);
    return 0;
  }

  const format = values.format as keyof typeof FORMATTERS;
  if (!(format in FORMATTERS)) {
    io.stderr(`error: unknown format '${values.format}' (use text, json or markdown)`);
    return 2;
  }

  const file = positionals[0];
  if (!file) {
    io.stderr('error: missing report file');
    io.stderr(USAGE);
    return 2;
  }

  const inputFormat = values['input-format'] ?? 'playwright';
  if (inputFormat !== 'playwright' && inputFormat !== 'cypress') {
    io.stderr(`error: unknown input format '${inputFormat}' (use playwright or cypress)`);
    return 2;
  }

  const options: AnalyzeOptions = { solve: { timeBudgetMs: 200 }, format: inputFormat };
  let maxFeedbackMs: number | undefined;
  let maxCostWastePct: number | undefined;
  try {
    if (values.workers) options.workersPerShard = parseIntOption(values.workers, 'workers');
    if (values['max-shards']) options.maxShards = parseIntOption(values['max-shards'], 'max-shards');
    if (values.shards) options.currentShardCount = parseIntOption(values.shards, 'shards');
    if (values.overhead) options.startupOverheadMs = parseDuration(values.overhead);
    if (values['max-feedback']) maxFeedbackMs = parseDuration(values['max-feedback']);
    if (values['max-cost-waste']) maxCostWastePct = Number(values['max-cost-waste']);
  } catch (error) {
    io.stderr(`error: ${(error as Error).message}`);
    return 2;
  }

  let text: string;
  try {
    text = io.readFile(file);
  } catch (error) {
    io.stderr(`error: cannot read '${file}': ${(error as Error).message}`);
    return 2;
  }

  let result;
  try {
    result = analyze(text, options);
  } catch (error) {
    io.stderr(`error: ${(error as Error).message}`);
    return 2;
  }

  io.stdout(FORMATTERS[format](result));

  return evaluateGate(result.recommendation, { maxFeedbackMs, maxCostWastePct }, io);
}

function evaluateGate(
  recommendation: ReturnType<typeof analyze>['recommendation'],
  gate: { maxFeedbackMs?: number; maxCostWastePct?: number },
  io: CliIO,
): number {
  const { recommended, current } = recommendation;
  let failed = false;

  if (gate.maxFeedbackMs !== undefined && recommended.feedbackTimeMs > gate.maxFeedbackMs) {
    io.stderr(
      `gate failed: best feedback time ${formatDuration(recommended.feedbackTimeMs)} exceeds budget ${formatDuration(gate.maxFeedbackMs)}`,
    );
    failed = true;
  }

  if (gate.maxCostWastePct !== undefined && current && current.costMs > 0) {
    const wastePct = ((current.costMs - recommended.costMs) / current.costMs) * 100;
    if (wastePct > gate.maxCostWastePct) {
      io.stderr(
        `gate failed: current config wastes ${wastePct.toFixed(1)}% cost vs recommended (limit ${gate.maxCostWastePct}%)`,
      );
      failed = true;
    }
  }

  return failed ? 1 : 0;
}
