import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import Ajv from 'ajv';
import type { ValidateFunction } from 'ajv';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import schema from '../schemas/analysis-summary.schema.json';

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
 * Contract tests: the POST /analyze response must always match the published
 * JSON Schema, so an accidental change to its shape is caught here (and in the
 * REST Assured suite, which validates the same schema over real HTTP).
 */
describe('POST /analyze contract', () => {
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

  it('conforms to the schema without a current config', async () => {
    const response = await app.inject({ method: 'POST', url: '/analyze', payload: report });
    const valid = validate(response.json());
    expect(validate.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
  });

  it('conforms to the schema with the current-config comparison', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/analyze?shards=2&overheadMs=30000',
      payload: report,
    });
    const body = response.json();
    const valid = validate(body);
    expect(validate.errors ?? []).toEqual([]);
    expect(valid).toBe(true);
    // The optional contract fields are present in this mode.
    expect(body.current).toBeDefined();
    expect(body.savings).toBeDefined();
  });
});
