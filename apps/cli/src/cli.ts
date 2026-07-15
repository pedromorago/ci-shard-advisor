import { parseArgs } from 'node:util';
import { basename } from 'node:path';
import {
  advise,
  toAdvisorText,
  toAdvisorJson,
  toAdvisorMarkdown,
  toGitHubActions,
  toBitbucketPipelines,
} from '@ci-shard-advisor/core';
import type { AnalyzeInput, CostModel, Objective, ReportFile, ReportFormat, AdvisorResult } from '@ci-shard-advisor/core';
import { parseDuration, parseIntOption } from './duration';

/** Injected I/O so the CLI is testable without a process or the filesystem. */
export interface CliIO {
  readFile: (path: string) => string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

const USAGE = `ci-shard-advisor <reports...> [options]   # one Cypress report per container

Analyze the reports of your last sharded run (one file per shard, or one merged
report) and get your current situation plus the moves that improve it.

Options:
  --setup <duration>       per-shard startup overhead (e.g. 45s)  [needed for cost]
  --price <num>            machine price per minute               [optional, adds money]
  --shards <n>             declared container count for a single merged report
  --objective <recommended|fastest>   the chosen move (default: recommended, the knee)
  --max-feedback <dur>     objective: cheapest within this feedback budget
  --budget <price|dur>     objective: fastest within this cost budget
  --max-shards <n>         largest shard count to evaluate
  --format <text|json|markdown|github|bitbucket>   output (default: text)
  --input-format <auto|playwright|cypress|mochawesome>   report format (default: auto)

Quality gates (non-zero exit on failure):
  --gate-feedback <dur>    fail if the best achievable feedback exceeds the limit
  --gate-cost-waste <pct>  fail if your current config wastes more than pct% cost

  -h, --help               show this help`;

const REPORT_FORMATS = { text: toAdvisorText, json: toAdvisorJson, markdown: toAdvisorMarkdown };
const CI_FORMATS = { github: toGitHubActions, bitbucket: toBitbucketPipelines };
const ALL_FORMATS = [...Object.keys(REPORT_FORMATS), ...Object.keys(CI_FORMATS)];

/** Parse --budget: a duration (machine time) or a money amount (needs --price). */
function parseBudget(raw: string, pricePerMinute: number | undefined): Objective {
  if (/^\d+(\.\d+)?(ms|s|m)$/.test(raw.trim())) {
    return { kind: 'budget', costMs: parseDuration(raw) };
  }
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`--budget must be a duration (e.g. 5m) or a price amount`);
  }
  if (pricePerMinute === undefined) {
    throw new Error('--budget as a price needs --price to be set');
  }
  return { kind: 'budget', costMs: (amount / pricePerMinute) * 60_000 };
}

/**
 * Run the CLI. Returns the exit code: 0 success, 1 a quality gate failed, 2 a
 * usage or input error.
 */
export function run(argv: string[], io: CliIO): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        setup: { type: 'string' },
        price: { type: 'string' },
        shards: { type: 'string' },
        objective: { type: 'string' },
        'max-feedback': { type: 'string' },
        budget: { type: 'string' },
        'max-shards': { type: 'string' },
        format: { type: 'string', default: 'text' },
        'input-format': { type: 'string' },
        'gate-feedback': { type: 'string' },
        'gate-cost-waste': { type: 'string' },
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

  const format = values.format as string;
  if (!ALL_FORMATS.includes(format)) {
    io.stderr(`error: unknown format '${values.format}' (use ${ALL_FORMATS.join(', ')})`);
    return 2;
  }
  if (positionals.length === 0) {
    io.stderr('error: at least one report file is required');
    io.stderr(USAGE);
    return 2;
  }

  // Options and the cost model.
  const cost: CostModel = { startupOverheadMs: 0 };
  let maxShards: number | undefined;
  let currentShardCount: number | undefined;
  let inputFormat: ReportFormat | undefined;
  let objective: Objective | undefined;
  let gateFeedbackMs: number | undefined;
  let gateCostWastePct: number | undefined;
  try {
    if (values.setup) cost.startupOverheadMs = parseDuration(values.setup);
    if (values.price) {
      const price = Number(values.price);
      if (!Number.isFinite(price) || price < 0) throw new Error('--price must be a number >= 0');
      cost.pricePerMinute = price;
    }
    if (values['max-shards']) maxShards = parseIntOption(values['max-shards'], 'max-shards');
    if (values.shards) currentShardCount = parseIntOption(values.shards, 'shards');
    if (values['gate-feedback']) gateFeedbackMs = parseDuration(values['gate-feedback']);
    if (values['gate-cost-waste']) {
      gateCostWastePct = Number(values['gate-cost-waste']);
      if (!Number.isFinite(gateCostWastePct) || gateCostWastePct < 0) {
        throw new Error(`--gate-cost-waste must be a percentage >= 0, got '${values['gate-cost-waste']}'`);
      }
    }
    if (values['input-format'] && values['input-format'] !== 'auto') {
      const forced = values['input-format'];
      if (forced !== 'playwright' && forced !== 'cypress' && forced !== 'mochawesome') {
        throw new Error(`--input-format must be auto, playwright, cypress or mochawesome`);
      }
      inputFormat = forced;
    }

    if (values['max-feedback']) {
      objective = { kind: 'max-feedback', feedbackMs: parseDuration(values['max-feedback']) };
    } else if (values.budget) {
      objective = parseBudget(values.budget, cost.pricePerMinute);
    } else if (values.objective) {
      const o = values.objective;
      if (o !== 'recommended' && o !== 'fastest') {
        throw new Error(`--objective must be recommended or fastest`);
      }
      // 'recommended' is the knee criterion — the core's 'balanced' objective.
      objective = { kind: o === 'recommended' ? 'balanced' : o };
    }
  } catch (error) {
    io.stderr(`error: ${(error as Error).message}`);
    return 2;
  }

  // Read the report files.
  const reports: ReportFile[] = [];
  for (const path of positionals) {
    try {
      reports.push({ name: basename(path), content: io.readFile(path) });
    } catch (error) {
      io.stderr(`error: cannot read '${path}': ${(error as Error).message}`);
      return 2;
    }
  }

  if (currentShardCount !== undefined && reports.length >= 2) {
    io.stderr('warning: --shards only applies to a single merged report; ignored (you passed one report per shard)');
  }

  const input: AnalyzeInput =
    reports.length >= 2
      ? { kind: 'per-shard', reports }
      : { kind: 'merged', report: reports[0], currentShardCount: currentShardCount ?? 1 };

  let result: AdvisorResult;
  try {
    result = advise(input, cost, { objective, maxShards, inputFormat });
  } catch (error) {
    io.stderr(`error: ${(error as Error).message}`);
    return 2;
  }

  if (format in REPORT_FORMATS) {
    io.stdout(REPORT_FORMATS[format as keyof typeof REPORT_FORMATS](result, cost));
  } else {
    // CI config for the chosen (objective) scenario: one job per shard, each
    // running exactly its spec list (the applicable plan, spec §5.3).
    const chosen = result.scenarios.find((s) => s.id === 'objective') ?? result.scenarios[0];
    if (!chosen.plan) {
      io.stderr('error: the chosen scenario has no applicable plan');
      return 2;
    }
    io.stdout(CI_FORMATS[format as keyof typeof CI_FORMATS](chosen.plan.specs, result.runner));
  }

  return evaluateGates(result, { gateFeedbackMs, gateCostWastePct }, io);
}

function evaluateGates(
  result: AdvisorResult,
  gate: { gateFeedbackMs?: number; gateCostWastePct?: number },
  io: CliIO,
): number {
  let failed = false;

  if (gate.gateFeedbackMs !== undefined) {
    const best = Math.min(...result.frontier.map((p) => p.feedbackTimeMs));
    if (best > gate.gateFeedbackMs) {
      io.stderr(`gate failed: best achievable feedback exceeds the limit`);
      failed = true;
    }
  }

  if (gate.gateCostWastePct !== undefined) {
    const cheaper = result.scenarios.find((s) => s.id === 'same-feedback-cheaper' && !s.unavailable);
    const current = result.current;
    if (cheaper && current.costMs > 0) {
      const wastePct = ((current.costMs - cheaper.config.costMs) / current.costMs) * 100;
      if (wastePct > gate.gateCostWastePct) {
        io.stderr(`gate failed: current config wastes ${wastePct.toFixed(1)}% cost (limit ${gate.gateCostWastePct}%)`);
        failed = true;
      }
    }
  }

  return failed ? 1 : 0;
}
