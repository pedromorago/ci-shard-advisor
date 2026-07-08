# Performance tests — CI Shard Advisor API

Load tests for the local API, in two tools. Start the API first:

```bash
pnpm --filter @ci-shard-advisor/api start   # http://127.0.0.1:3001
```

## k6

A JS load test that ramps to 20 virtual users and **fails** if the SLOs are
breached (p95 latency, error rate, check success) — a pass/fail gate, not just a
report.

```bash
k6 run apps/api/perf/k6/analyze-load.js
# custom target: k6 run -e API_BASE_URL=http://localhost:3001 apps/api/perf/k6/analyze-load.js
```

Thresholds (in [`k6/analyze-load.js`](k6/analyze-load.js)):

| Metric | SLO |
| --- | --- |
| `http_req_failed` | error rate < 1% |
| `http_req_duration` | p95 < 500ms |
| `checks` | > 99% pass |

## JMeter

An equivalent plan: a thread group of 20 users over 60s against `POST /analyze`,
with a response-code assertion (200) and a duration assertion (< 500ms).

```bash
# headless (CI-friendly), writes a results file:
jmeter -n -t apps/api/perf/jmeter/analyze-plan.jmx -l results.jtl \
  -Jhost=localhost -Jport=3001
```

Open `analyze-plan.jmx` in the JMeter GUI to explore or extend it.
