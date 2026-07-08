# Sample reports

Ready-made reports to try CI Shard Advisor in every supported format. The format
is auto-detected, so you can drop any of these into the web, the CLI or the API.

| File | Format | What it shows |
| --- | --- | --- |
| `playwright-report.json` | Playwright JSON | A balanced suite (2 projects, a flaky test, a skip) — a clear knee around 3–4 shards |
| `playwright-bottleneck.json` | Playwright JSON | One 3-minute test dominates — more shards don't help; the advice is *fewer* shards |
| `cypress-run.json` | Cypress run result (Module API) | Specs with retries (flaky) and a pending test |
| `mochawesome.json` | mochawesome (Cypress/Mocha) | Nested suites, a failure and a pending test |
| [`playwright-dev-shards/`](playwright-dev-shards) | Playwright JSON × 4 | A **real** 4-shard run (measured setup with imbalance) — pass all four at once |

The single files above are one merged report each (the advisor *models* the
split). The `playwright-dev-shards/` folder is one report **per shard** from a
real run, so the advisor *measures* your setup — see its [README](playwright-dev-shards/README.md).

## Try them in the web (easiest)

```bash
pnpm --filter @ci-shard-advisor/web dev     # http://localhost:5173
```

Then use **Upload your shard reports** and pick any file above. Adjust the startup
overhead, price per minute, workers per shard and your current shard count to see
the moves change.

## Try them in the CLI

```bash
# a single merged report (modeled current), split into 6 shards
pnpm --filter @ci-shard-advisor/cli exec tsx src/bin.ts \
  "$PWD/samples/playwright-report.json" --setup 30s --shards 6

# one report per shard (measured current) — pass one file per shard
pnpm --filter @ci-shard-advisor/cli exec tsx src/bin.ts \
  "$PWD/samples/playwright-report.json" "$PWD/samples/playwright-bottleneck.json" \
  --setup 45s --price 0.008
```

> Note: use the `exec tsx src/bin.ts` form above. The `pnpm ... start -- <args>`
> shorthand does not forward flags reliably through pnpm, so `--setup` etc.
> would be dropped.

## Try them in the API

```bash
pnpm --filter @ci-shard-advisor/api start &   # http://127.0.0.1:3001
curl -X POST 'http://127.0.0.1:3001/advise?setupMs=30000&shards=6' \
  -H 'content-type: application/json' --data-binary @samples/playwright-report.json
```
