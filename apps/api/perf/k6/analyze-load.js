import http from 'k6/http';
import { check, sleep } from 'k6';

// Load test for the CI Shard Advisor API. Start the API first, then:
//   k6 run apps/api/perf/k6/analyze-load.js
// Override the target with -e API_BASE_URL=http://host:port
const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3001';

const REPORT = JSON.stringify({
  suites: [
    {
      specs: [
        { title: 'a', tags: ['@sanity'], tests: [{ status: 'expected', results: [{ duration: 10000 }] }] },
        { title: 'b', tests: [{ status: 'expected', results: [{ duration: 20000 }] }] },
        { title: 'c', tests: [{ status: 'expected', results: [{ duration: 30000 }] }] },
        { title: 'd', tests: [{ status: 'expected', results: [{ duration: 40000 }] }] },
      ],
    },
  ],
});

// Ramp up to 20 virtual users, hold, then ramp down. Fail the run if the p95
// latency or the error rate breach the SLOs — this is a pass/fail gate, not
// just a report.
export const options = {
  stages: [
    { duration: '15s', target: 20 },
    { duration: '30s', target: 20 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // < 1% errors
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    checks: ['rate>0.99'],
  },
};

export default function () {
  const res = http.post(`${BASE_URL}/analyze?shards=6&overheadMs=30000`, REPORT, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'body has a recommendation': (r) => r.json('recommended.shardCount') >= 1,
    'body has a frontier': (r) => Array.isArray(r.json('frontier')),
  });

  sleep(1);
}

// A light smoke of the health endpoint, run once per VU iteration cycle.
export function setup() {
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'health is ok': (r) => r.status === 200 });
}
