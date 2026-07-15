# @ci-shard-advisor/api

Local (not publicly deployed) HTTP API that wraps the core, so backend/API
testing can be demonstrated against a real service (ADR-003). It validates HTTP
and delegates to the v2 advisor gate `advise()` — no filesystem, no database.

## Run

```bash
pnpm --filter @ci-shard-advisor/api start   # http://127.0.0.1:3001 (PORT to override)
```

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness check → `{ "status": "ok" }` |
| `POST` | `/advise` | Body: a test report (or `{ "reports": [...] }`, one per shard). Returns the current situation, four moves, findings and the frontier. |

The body is either a single report object (**merged** → the current setup is
*modeled* by test count) or `{ "reports": [r1, r2, ...] }` — two or more reports
make a **per-shard** setup, so the current situation is *measured* from real
per-container times. The expected input is a Cypress report (Module API or
mochawesome), auto-detected.

`POST /advise` query parameters: `shards` (declared container count for a
merged report), `setupMs` (per-container startup overhead, default `30000`),
`maxShards`, `pricePerMinute` (enables euro prices), `currency` (default `€`),
`objective` (`recommended` | `fastest`), `maxFeedbackMs`, `budgetMs`. A
malformed report or bad parameter returns `400` with `{ "error": "..." }`.

```bash
# one merged report
curl -X POST 'http://127.0.0.1:3001/advise?shards=6&setupMs=30000&pricePerMinute=0.01' \
  -H 'content-type: application/json' --data-binary @report.json

# one report per shard (measured)
curl -X POST 'http://127.0.0.1:3001/advise' -H 'content-type: application/json' \
  -d '{"reports":[<shard-1>,<shard-2>,<shard-3>]}'
```

## Tests

TypeScript integration tests drive the app in-process with Fastify's `inject`,
including a **contract test** that validates the `/advise` response against the
published JSON Schema ([`schemas/`](schemas)) with ajv:

```bash
pnpm --filter @ci-shard-advisor/api test
```

### Java REST Assured suite (`rest-assured/`)

A JUnit 5 + REST Assured suite exercises the running service over real HTTP —
health, a merged advice call, the measured per-shard setup, the JSON Schema
contract, and the `400` error paths. Requires JDK 17+ and Maven:

```bash
pnpm --filter @ci-shard-advisor/api start &     # start the API first
cd apps/api/rest-assured
mvn test                                          # or: mvn -DAPI_BASE_URL=http://localhost:3001 test
```

### Performance (`perf/`)

Load tests against `POST /advise` with **k6** and **JMeter**, with pass/fail
SLOs (p95 latency, error rate). See [`perf/README.md`](perf/README.md).
