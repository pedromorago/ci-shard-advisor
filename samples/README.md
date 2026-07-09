# Sample reports

Ready-made Cypress reports to try CI Shard Advisor. The format (Module API or
mochawesome) is auto-detected — drop any of these into the web, the CLI or the API.

| File | Format | What it shows |
| --- | --- | --- |
| [`cypress-containers/`](cypress-containers) | Module API × 3 | **One report per container** (the preferred input): imbalance, a flaky retry and a slow checkout spec — the web demo data |
| `cypress-run.json` | Module API (merged) | Specs with retries (flaky) and a pending test |
| `mochawesome.json` | mochawesome (merged) | Nested suites, a failure and a pending test |

The single files are one merged report each (the advisor *models* the split
from your declared container count). The `cypress-containers/` folder has one
report **per container**, so the advisor *measures* your setup — imbalance
included.

> The `playwright-*` files and `playwright-dev-shards/` remain from the parked
> Playwright reader (kept in the code, out of the pitch).

## Try them in the web (easiest)

```bash
pnpm --filter @ci-shard-advisor/web dev     # http://localhost:5173
```

Then use **Upload your Cypress reports** and pick the three
`cypress-containers/*.json` at once. Adjust the startup overhead and price per
minute to see the moves change.

## Try them in the CLI

```bash
# one report per container (measured current)
pnpm --filter @ci-shard-advisor/cli exec tsx src/bin.ts \
  "$PWD"/samples/cypress-containers/container-{1,2,3}.json --setup 45s --price 0.008

# a single merged report (modeled current), declared as 3 containers
pnpm --filter @ci-shard-advisor/cli exec tsx src/bin.ts \
  "$PWD/samples/cypress-run.json" --setup 30s --shards 3
```

> Note: use the `exec tsx src/bin.ts` form above. The `pnpm ... start -- <args>`
> shorthand does not forward flags reliably through pnpm, so `--setup` etc.
> would be dropped.

## Try them in the API

```bash
pnpm --filter @ci-shard-advisor/api start &   # http://127.0.0.1:3001
curl -X POST 'http://127.0.0.1:3001/advise?setupMs=30000&shards=3' \
  -H 'content-type: application/json' --data-binary @samples/cypress-run.json
```
