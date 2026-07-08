import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';

const report = {
  suites: [
    {
      specs: [
        { title: 'a', tags: ['@sanity'], tests: [{ status: 'expected', results: [{ duration: 10000 }] }] },
        { title: 'b', tests: [{ status: 'expected', results: [{ duration: 20000 }] }] },
        { title: 'c', tests: [{ status: 'expected', results: [{ duration: 30000 }] }] },
      ],
    },
  ],
};

describe('API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('analyzes a posted report', async () => {
    const response = await app.inject({ method: 'POST', url: '/analyze', payload: report });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.totalTests).toBe(3);
    expect(body.recommended.shardCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.frontier)).toBe(true);
  });

  it('includes the current-config comparison when shards is given', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/analyze?shards=3&overheadMs=30000',
      payload: report,
    });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.current.shardCount).toBe(3);
    expect(body.savings).toBeDefined();
  });

  it('analyzes a Cypress report with ?format=cypress', async () => {
    const cypress = {
      runs: [
        {
          spec: { relative: 'a.cy.ts' },
          tests: [{ title: ['A', 't1'], state: 'passed', duration: 10000 }],
        },
      ],
    };
    const response = await app.inject({ method: 'POST', url: '/analyze?format=cypress', payload: cypress });
    expect(response.statusCode).toBe(200);
    expect(response.json().totalTests).toBe(1);
  });

  it('rejects an unknown format with 400', async () => {
    const response = await app.inject({ method: 'POST', url: '/analyze?format=jest', payload: report });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatch(/format/);
  });

  it('rejects a structurally invalid report with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: { suites: 'not-an-array' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatch(/suites/);
  });

  it('rejects an invalid query parameter with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/analyze?workers=lots',
      payload: report,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatch(/workers/);
  });

  it('rejects a non-JSON body with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/analyze',
      headers: { 'content-type': 'application/json' },
      payload: '{ not json',
    });
    expect(response.statusCode).toBe(400);
  });
});
