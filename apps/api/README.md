# @ci-shard-advisor/api

Local (not publicly deployed) HTTP API that wraps the core, so backend/API
testing can be demonstrated against a real service (ADR-003). It validates HTTP
and delegates to the analysis engine — no filesystem, no database.

## Run

```bash
pnpm --filter @ci-shard-advisor/api start   # http://127.0.0.1:3001 (PORT to override)
```

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness check → `{ "status": "ok" }` |
| `POST` | `/analyze` | Body: a Playwright JSON report. Returns the analysis summary. |

`POST /analyze` query parameters: `shards` (current shard count), `workers`,
`overheadMs`, `maxShards`, `format` (`playwright` | `cypress`). A malformed
report or bad parameter returns `400` with `{ "error": "..." }`.

```bash
curl -X POST 'http://127.0.0.1:3001/analyze?shards=6&overheadMs=30000' \
  -H 'content-type: application/json' --data-binary @report.json
```

## Tests

TypeScript integration tests drive the app in-process with Fastify's `inject`,
including a **contract test** that validates the `/analyze` response against the
published JSON Schema ([`schemas/`](schemas)) with ajv:

```bash
pnpm --filter @ci-shard-advisor/api test
```

### Java REST Assured suite (`rest-assured/`)

A JUnit 5 + REST Assured suite exercises the running service over real HTTP —
health, a successful analysis, the current-config comparison, and the `400`
error paths. Requires JDK 17+ and Maven:

```bash
pnpm --filter @ci-shard-advisor/api start &     # start the API first
cd apps/api/rest-assured
mvn test                                          # or: mvn -DAPI_BASE_URL=http://localhost:3001 test
```

### Performance (`perf/`)

Load tests against `POST /analyze` with **k6** and **JMeter**, with pass/fail
SLOs (p95 latency, error rate). See [`perf/README.md`](perf/README.md).
