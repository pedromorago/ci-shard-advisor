import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { analyze, toSummaryObject } from '@ci-shard-advisor/core';
import type { AnalyzeOptions, ReportFormat, Priority } from '@ci-shard-advisor/core';

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

interface AnalyzeQuery {
  shards?: string;
  workers?: string;
  overheadMs?: string;
  maxShards?: string;
  format?: string;
  priority?: string;
}

/** Validate the optional priority query param (a preset or numeric value). */
function priorityParam(raw: string | undefined): Priority | undefined {
  if (raw === undefined) return undefined;
  if (raw === 'knee' || raw === 'fastest' || raw === 'cheapest') return raw;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('priority must be knee, fastest, cheapest or a number >= 0');
  }
  return value;
}

/** Validate the optional report-format query param. */
function reportFormat(raw: string | undefined): ReportFormat | 'auto' | undefined {
  if (raw === undefined) return undefined;
  const allowed = ['auto', 'playwright', 'cypress', 'mochawesome', 'junit'] as const;
  if (!(allowed as readonly string[]).includes(raw)) {
    throw new Error(`format must be one of: ${allowed.join(', ')}`);
  }
  return raw as ReportFormat | 'auto';
}

/**
 * Build the local API that wraps the core. It never touches the filesystem or
 * a database — it just validates HTTP and delegates to the analysis engine
 * (ADR-003). Returned as a factory so tests can drive it with `.inject()`.
 */
export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get('/health', async () => ({ status: 'ok' }));

  app.post<{ Body: unknown; Querystring: AnalyzeQuery }>('/analyze', async (request, reply) => {
    let options: AnalyzeOptions;
    try {
      const query = request.query;
      options = { solve: { timeBudgetMs: 200 } };
      const workers = positiveInt(query.workers, 'workers');
      const maxShards = positiveInt(query.maxShards, 'maxShards');
      const shards = positiveInt(query.shards, 'shards');
      const overheadMs = nonNegative(query.overheadMs, 'overheadMs');
      const format = reportFormat(query.format);
      const priority = priorityParam(query.priority);
      if (workers !== undefined) options.workersPerShard = workers;
      if (maxShards !== undefined) options.maxShards = maxShards;
      if (shards !== undefined) options.currentShardCount = shards;
      if (overheadMs !== undefined) options.startupOverheadMs = overheadMs;
      if (format !== undefined) options.format = format;
      if (priority !== undefined) options.priority = priority;
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }

    try {
      const result = analyze(request.body, options);
      return toSummaryObject(result);
    } catch (error) {
      return reply.code(400).send({ error: (error as Error).message });
    }
  });

  return app;
}
