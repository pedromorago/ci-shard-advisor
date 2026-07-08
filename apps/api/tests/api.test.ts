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

  it('advises over a merged report (modeled current)', async () => {
    const response = await app.inject({ method: 'POST', url: '/advise', payload: report });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.totalTests).toBe(3);
    expect(body.current.measured).toBe(false);
    expect(body.scenarios).toHaveLength(4);
    expect(Array.isArray(body.frontier)).toBe(true);
  });

  it('measures the current setup from per-shard reports', async () => {
    const shardA = { suites: [{ specs: [{ title: 'a', tests: [{ status: 'expected', results: [{ duration: 50000 }] }] }] }] };
    const shardB = { suites: [{ specs: [{ title: 'b', tests: [{ status: 'expected', results: [{ duration: 10000 }] }] }] }] };
    const response = await app.inject({
      method: 'POST',
      url: '/advise',
      payload: { reports: [shardA, shardB] },
    });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.current.measured).toBe(true);
    expect(body.current.shardCount).toBe(2);
    // shard A (50s) is slower than shard B (10s) → measured imbalance.
    expect(body.current.imbalanceMs).toBeGreaterThan(0);
  });

  it('models the current shard count for a merged report with ?shards', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/advise?shards=3&setupMs=30000',
      payload: report,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().current.shardCount).toBe(3);
  });

  it('shows euro prices when ?pricePerMinute is set', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/advise?pricePerMinute=0.02',
      payload: report,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().current.price).toMatch(/^€\d+\.\d\d$/);
  });

  it('advises over a Cypress report (auto-detected)', async () => {
    const cypress = {
      runs: [
        {
          spec: { relative: 'a.cy.ts' },
          tests: [{ title: ['A', 't1'], state: 'passed', duration: 10000 }],
        },
      ],
    };
    const response = await app.inject({ method: 'POST', url: '/advise', payload: cypress });
    expect(response.statusCode).toBe(200);
    expect(response.json().totalTests).toBe(1);
  });

  it('rejects an unknown objective with 400', async () => {
    const response = await app.inject({ method: 'POST', url: '/advise?objective=cheapish', payload: report });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatch(/objective/);
  });

  it('rejects a structurally invalid report with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/advise',
      payload: { suites: 'not-an-array' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatch(/suites/);
  });

  it('rejects an invalid query parameter with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/advise?workers=lots',
      payload: report,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatch(/workers/);
  });

  it('rejects a non-JSON body with 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/advise',
      headers: { 'content-type': 'application/json' },
      payload: '{ not json',
    });
    expect(response.statusCode).toBe(400);
  });
});
