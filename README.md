# CI Shard Advisor

[![CI](https://github.com/pedro-morago/ci-shard-advisor/actions/workflows/ci.yml/badge.svg)](https://github.com/pedro-morago/ci-shard-advisor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D22-3c873a)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)

Analyze your **Playwright** or **Cypress** shard reports and find the CI sharding
strategy that balances **feedback time** against **cost** — with an exact
scheduler, a faithful worker simulator, and an honest cost/time frontier.

**▶ Live demo: [pedro-morago.github.io/ci-shard-advisor](https://pedro-morago.github.io/ci-shard-advisor/)** — runs entirely in your browser; drop in your own shard reports.

## Why

Most teams pick their number of CI shards by gut feeling: "let's use 8 because
the pipeline feels slow". More shards do reduce feedback time, but every shard
adds startup overhead and billed minutes. At some point the extra cost stops
paying for the seconds saved.

CI Shard Advisor answers that question with data: it reads a real Playwright
report, models how shards and workers actually behave, builds a cost-time
frontier and recommends the configuration where the trade-off makes sense — and
tells you how it compares to what you run today.

## A quick look

You give it one report per shard, so it *measures* where you are today — then
shows your moves and what each one costs or saves:

```text
$ ci-shard-advisor shard-*.json --setup 45s --price 0.008

Your current setup (measured)
  4 shards × 1 worker
  Feedback time: 4m 5s   (slowest shard: #1)
  Billed cost:   10m 50s  →  €0.09 per run
  ⚠ Imbalance: shard #4 finishes 2m 0s before shard #1. You are paying for idle machines.

Your moves
  Free) Rebalance your 4 shards   feedback 3m 45s (−20.0s)   cost €0.09 (±0)
     Same machines, tests redistributed by duration — rebalancing is free.
     Apply (each machine runs its own list):
       shard 1: npx playwright test checkout.spec.ts
       shard 2: npx playwright test cart.spec.ts login.spec.ts settings.spec.ts
       shard 3: npx playwright test filters.spec.ts search.spec.ts
       shard 4: npx playwright test profile.spec.ts signup.spec.ts
  Recommended) 3 shards   feedback 3m 45s (−20.0s)   cost €0.08 (−€0.01)
     The knee of the cost/time frontier — past it, shards stop paying off.
     (--format github or bitbucket emits the full, paste-ready CI config)

Warnings
  • You run 4 shards, but past 3 you only pay more: +7% cost for −20.0s.
  • Past 3 shards the wait stops dropping: 'checkout.spec.ts' (3m 0s) sets the floor. Consider splitting it.
  • Your fastest shard finishes 2m 0s before the slowest — you are paying for idle machines.
```

You are not at the optimum, but the optimum is not 6 shards either: your fourth
shard buys nothing, one slow file sets the floor, and your shards are unbalanced.
The web demo shows the same analysis as an interactive cost/time frontier,
processed entirely in your browser.

## Architecture

Lightweight hexagonal architecture: a pure TypeScript **core** (no framework,
no I/O) with thin adapters on top. The core knows nothing about React, HTTP or
the command line.

```text
   Web (React/Vite)     CLI (Node)     Local API (Fastify)
          \                 |                 /
           v                v                v
                     packages/core
   parser → normalizer → classifier → scheduler → workers → recommender → exporters
```

| Package | What it is |
| --- | --- |
| [`packages/core`](packages/core) | Pure engine: parser, scheduler (branch & bound), worker simulator, recommender, exporters |
| [`apps/web`](apps/web) | Static React + Vite demo — analysis runs 100% in the browser |
| [`apps/cli`](apps/cli) | Node CLI with a CI quality-gate mode |
| [`apps/api`](apps/api) | Local Fastify API + a Java REST Assured suite |

See [docs/architecture.md](docs/architecture.md) and the
[decision records](docs/decisions.md) for the design rationale.

## Engineering highlights

- **Exact scheduler.** A hand-written branch & bound solver partitions tasks
  across shards to minimize makespan, with symmetry breaking, bound-based
  pruning and a time budget. It never lies: if it can't certify the optimum in
  time, it says so and reports the gap.
- **Faithful simulation.** The worker simulator models the runner's real queue
  (greedy, no reordering), so estimates reflect the tool, not an ideal.
- **Framework-agnostic engine.** Only the input reader is tool-specific. It reads
  **Playwright JSON** and **Cypress** run results (native or mochawesome), with the
  format auto-detected. Adding another reader is all it takes; the engine never
  changes.
- **Privacy by construction.** The web processes reports in the browser and
  never uploads them — proven by a dedicated E2E test.
- **Closes the loop to CI.** From the recommendation it generates ready-to-paste
  **GitHub Actions** and **Bitbucket Pipelines** config that shards the run and
  merges the reports back into the JSON it reads. See [examples/ci/](examples/ci).

## Testing strategy

Testing is the point of this project, not an afterthought. Every layer is
covered with the technique that fits it:

- **Property-based testing** against a brute-force **oracle** — the clever
  branch & bound is checked against a trivially-correct exhaustive solver over
  hundreds of random (seeded, reproducible) instances.
- **Metamorphic & differential tests** — the simulator can never beat the
  scheduler's optimum; rescaling a chart axis never moves the recommended knee.
- **Invariants** — "the engine never lies", work conservation, monotonicity.
- **Snapshot testing** for the deterministic text/Markdown exporters.
- **Component tests** (Testing Library) querying by role and accessible name.
- **End-to-end** in **Playwright and Cypress**: the upload flow, an
  **accessibility** scan (axe) and a **privacy** test asserting the report never
  leaves the page.
- **API testing** in two languages — Fastify `inject` in TS and a **JUnit 5 +
  REST Assured** suite over real HTTP — plus **JSON Schema contract** checks.
- **Performance testing** of the API with **k6** and **JMeter** (pass/fail SLOs).
- **Mutation testing** (Stryker) and enforced **coverage** thresholds on the core.
- **Jira/Xray**-ready: every suite emits **JUnit XML** for test-management import.

The full catalog, with the rationale and file paths for each technique, is in
[docs/testing.md](docs/testing.md).

## Development

Requires Node.js 22+ and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm test        # run all workspace tests
pnpm typecheck   # strict TypeScript checks

pnpm --filter @ci-shard-advisor/web dev      # web demo at http://localhost:5173
pnpm --filter @ci-shard-advisor/cli start -- report.json
pnpm --filter @ci-shard-advisor/api start    # http://127.0.0.1:3001
```

## Roadmap

- [x] Monorepo setup
- [x] Phase 1 — Scheduling core (LPT, bounds, branch & bound, worker simulator, frontier)
- [x] Phase 2 — Web demo with preloaded analysis (upload, frontier chart, client-side), deployed to GitHub Pages
- [x] Phase 3 — Testing strategy (unit, integration, privacy, a11y)
- [x] Phase 4 — CLI with quality-gate mode
- [x] Phase 5 — Local API + Java REST Assured test suite
- [x] Phase 6 — Portfolio polish (CI, docs, badges)

## License

[MIT](LICENSE) © Pedro Morago
