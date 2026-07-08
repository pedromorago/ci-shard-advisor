import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { advise, toAdvisorObject } from '@ci-shard-advisor/core';
import type { AdviseOptions, AnalyzeInput, CostModel, Objective, ReportFile } from '@ci-shard-advisor/core';

/** Parse an optional positive-integer query param. */
function positiveInt(raw: string | undefined, name: string): number | undefined {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

/** Parse an optional non-negative-number query param. */
function nonNegative(raw: string | undefined, name: string): number | undefined {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a number >= 0`);
  }
  return value;
}

/**
 * Build the objective from the query. `maxFeedbackMs`/`budgetMs` are
 * parameterized objectives and take precedence; otherwise `objective` picks
 * recommended (the knee — the core's 'balanced') or fastest.
 */
function objectiveParam(query: AdviseQuery): Objective | undefined {
  const maxFeedbackMs = nonNegative(query.maxFeedbackMs, 'maxFeedbackMs');
  if (maxFeedbackMs !== undefined) return { kind: 'max-feedback', feedbackMs: maxFeedbackMs };
  const budgetMs = nonNegative(query.budgetMs, 'budgetMs');
  if (budgetMs !== undefined) return { kind: 'budget', costMs: budgetMs };
  if (query.objective === undefined) return undefined;
  if (query.objective === 'recommended') return { kind: 'balanced' };
  if (query.objective === 'fastest') return { kind: 'fastest' };
  throw new Error('objective must be recommended or fastest');
}

interface AdviseQuery {
  shards?: string;
  workers?: string;
  maxShards?: string;
  setupMs?: string;
  pricePerMinute?: string;
  currency?: string;
  objective?: string;
  maxFeedbackMs?: string;
  budgetMs?: string;
}

/** Default per-shard startup overhead when the caller does not set one. */
const DEFAULT_SETUP_MS = 30_000;

/**
 * Build the AnalyzeInput from the posted body. Two shapes are accepted:
 * - `{ reports: [...] }` — one entry per shard; two or more become a *measured*
 *   per-shard setup, a single one is *modeled* as merged.
 * - a bare report object — a single *modeled* merged report.
 */
function toInput(body: unknown, currentShardCount: number | undefined): AnalyzeInput {
  if (body && typeof body === 'object' && Array.isArray((body as { reports?: unknown }).reports)) {
    const raw = (body as { reports: unknown[] }).reports;
    if (raw.length === 0) throw new Error('reports must not be empty');
    const reports: ReportFile[] = raw.map((content, i) => ({ name: `shard-${i + 1}`, content }));
    if (reports.length >= 2) return { kind: 'per-shard', reports };
    return { kind: 'merged', report: reports[0], currentShardCount };
  }
  return { kind: 'merged', report: { name: 'report', content: body }, currentShardCount };
}

/**
 * The local API that wraps the core. It never touches the filesystem or a
 * database — it validates HTTP and delegates to the v2 advisor gate `advise()`
 * (ADR-003). Returned as a factory so tests can drive it with `.inject()`.
 */
export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ status: 'ok' }));

  app.post<{ Body: unknown; Querystring: AdviseQuery }>('/advise', async (request, reply) => {
    let cost: CostModel;
    let options: AdviseOptions;
    let shards: number | undefined;
    try {
      const query = request.query;
      const workers = positiveInt(query.workers, 'workers');
      const maxShards = positiveInt(query.maxShards, 'maxShards');
      shards = positiveInt(query.shards, 'shards');
      const setupMs = nonNegative(query.setupMs, 'setupMs') ?? DEFAULT_SETUP_MS;
      const pricePerMinute = nonNegative(query.pricePerMinute, 'pricePerMinute');
      const objective = objectiveParam(query);

      cost = { startupOverheadMs: setupMs };
      if (pricePerMinute !== undefined) cost.pricePerMinute = pricePerMinute;
      if (query.currency) cost.currency = query.currency;

      options = {};
      if (workers !== undefined) options.workersPerShard = workers;
      if (maxShards !== undefined) options.maxShards = maxShards;
      if (objective !== undefined) options.objective = objective;
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }

    try {
      const result = advise(toInput(request.body, shards), cost, options);
      return toAdvisorObject(result, cost);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  return app;
}
