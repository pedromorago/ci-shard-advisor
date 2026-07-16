import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import Ajv from 'ajv';
import type { ValidateFunction } from 'ajv';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import schema from '../schemas/advisor-result.schema.json';

const report = {
  suites: [
    {
      specs: [
        { title: 'a', tags: ['@sanity'], tests: [{ status: 'expected', results: [{ duration: 10000 }] }] },
        { title: 'b', tests: [{ status: 'expected', results: [{ duration: 20000 }] }] },
      ],
    },
  ],
};

/**
 * Contract tests: the POST /advise response must always match the published
 * JSON Schema, so an accidental change to its shape is caught here (and in the
 * REST Assured suite, which validates the same schema over real HTTP).
 */
describe('POST /advise contract', () => {
  let app: FastifyInstance;
  let validate: ValidateFunction;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    validate = new Ajv({ allErrors: true }).compile(schema);
  });

  afterAll(async () => {
    await app.close();
  });

  it('conforms to the schema for a merged report', async () => {
    const response = await app.inject({ method: 'POST', url: '/advise', payload: report });
    const valid = validate(response.json());
    expect(validate.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  it('conforms to the schema for a priced per-shard setup', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/advise?pricePerMinute=0.01&setupMs=30000',
      payload: { reports: [report, report] },
    });
    const body = response.json();
    const valid = validate(body);
    expect(validate.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
    // A measured per-shard setup carries a euro price and per-move prices.
    expect(body.current.measured).toBe(true);
    expect(body.current.price).toMatch(/^€/);
  });

  it('the REST Assured suite validates this exact schema (no silent drift)', async () => {
    // The Java suite needs its own classpath copy of the schema. That copy is
    // intentional — this guard is what keeps the two byte-identical, so the
    // TS and Java suites can never validate different contracts.
    const { readFile } = await import('node:fs/promises');
    const here = new URL('../schemas/advisor-result.schema.json', import.meta.url);
    const java = new URL(
      '../rest-assured/src/test/resources/advisor-result.schema.json',
      import.meta.url,
    );
    expect(await readFile(java, 'utf8')).toBe(await readFile(here, 'utf8'));
  });
});
