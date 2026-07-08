# Sample reports

Ready-made reports to try CI Shard Advisor in every supported format. The format
is auto-detected, so you can drop any of these into the web, the CLI or the API.

| File | Format | What it shows |
| --- | --- | --- |
| `playwright-report.json` | Playwright JSON | A balanced suite (2 projects, a flaky test, a skip) — a clear knee around 3–4 shards |
| `playwright-bottleneck.json` | Playwright JSON | One 3-minute test dominates — more shards don't help; the advice is *fewer* shards |
| `cypress-run.json` | Cypress run result (Module API) | Specs with retries (flaky) and a pending test |
| `mochawesome.json` | mochawesome (Cypress/Mocha) | Nested suites, a failure and a pending test |
| `junit-report.xml` | JUnit XML | A generic suite (as Jest/pytest/Maven emit) with a failure and a skip |

## Try them in the web (easiest)

```bash
pnpm --filter @ci-shard-advisor/web dev     # http://localhost:5173
```

Then use **Upload a test report** and pick any file above. Adjust the startup
overhead, workers per shard and your current shard count to see the recommendation
move.

## Try them in the CLI

```bash
pnpm --filter @ci-shard-advisor/cli exec tsx src/bin.ts \
  "$PWD/samples/playwright-report.json" --overhead 30s --shards 6
```

> Note: use the `exec tsx src/bin.ts` form above. The `pnpm ... start -- <args>`
> shorthand does not forward flags reliably through pnpm, so `--overhead` etc.
> would be dropped.

## Try them in the API

```bash
pnpm --filter @ci-shard-advisor/api start &   # http://127.0.0.1:3001
curl -X POST 'http://127.0.0.1:3001/analyze?overheadMs=30000&shards=6' \
  -H 'content-type: application/json' --data-binary @samples/playwright-report.json
```
