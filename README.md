# CI Shard Advisor

[![CI](https://github.com/pedro-morago/ci-shard-advisor/actions/workflows/ci.yml/badge.svg)](https://github.com/pedro-morago/ci-shard-advisor/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D22-3c873a)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)

Parallelize **Cypress** in CI with your head — and without Cypress Cloud.
Feed it one report per container and it measures where you are, then shows your
moves and what each one costs or saves: an exact scheduler, per-container spec
lists you can paste into your pipeline, and an honest cost/time frontier.

**▶ Live demo: [pedro-morago.github.io/ci-shard-advisor](https://pedro-morago.github.io/ci-shard-advisor/)** — runs entirely in your browser; drop in your own Cypress reports.

## Why

Most teams pick their number of Cypress containers by gut feeling: "let's use 8
because the pipeline feels slow". More containers do reduce feedback time, but
every one adds startup overhead and billed minutes — at some point the extra
cost stops paying for the seconds saved. And Cypress's official answer, Cypress
Cloud load balancing, is a paid online service.

CI Shard Advisor answers with data, locally and for free: it reads the
mochawesome (or Module API) reports of your last run — ideally one per
container, so your situation is *measured*, imbalance included — builds a
cost/time frontier over optimal splits, and shows your moves anchored to where
you are today: rebalance for free, same wait for less money, or the knee where
containers stop paying off. Every move ships the exact `--spec` list per
container and the CI config to apply it.

## A quick look

You give it one report per container, so it *measures* where you are today —
then shows your moves and what each one costs or saves:

```text
$ ci-shard-advisor container-*.json --setup 45s --price 0.008

Your current setup (measured)
  3 containers
  Feedback time: 3m 0s   (slowest container: #1)
  Billed cost:   6m 21s  →  €0.05 per run
  ⚠ Imbalance: container #3 finishes 1m 30s before container #1. You are paying for idle machines.

Your moves
  Free) Rebalance your 3 containers   feedback 3m 0s (±0)   cost €0.05 (±0)
     Same machines, tests redistributed by duration — rebalancing is free.
     Apply (each machine runs its own list):
       container 1: npx cypress run --spec "cypress/e2e/checkout.cy.ts"
       container 2: npx cypress run --spec "cypress/e2e/cart.cy.ts,cypress/e2e/search.cy.ts"
       container 3: npx cypress run --spec "cypress/e2e/login.cy.ts,cypress/e2e/profile.cy.ts"
  Recommended) 2 containers   feedback 3m 0s (±0)   cost €0.04 (−€0.01)
     The knee of the cost/time frontier — past it, containers stop paying off.
     (--format github or bitbucket emits the full, paste-ready CI config)

Warnings
  • You run 3 containers, but past 2 you only pay more: +13% cost for no faster.
  • Past 2 containers the wait stops dropping: 'cypress/e2e/checkout.cy.ts' (2m 15s) sets the floor. Consider splitting it.
  • Your fastest container finishes 1m 30s before the slowest — you are paying for idle machines.
  • 1 flaky test wasted 21.0s of machine time in retries this run.
```

Your third container buys nothing, one slow spec sets the floor, and a flaky
test is quietly billing you retries. The web demo shows the same analysis as an
interactive cost/time frontier, processed entirely in your browser.

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
  across containers to minimize makespan, with symmetry breaking, bound-based
  pruning and a time budget. It never lies: if it can't certify the optimum in
  time, it says so and reports the gap.
- **Faithful simulation.** The worker simulator models the runner's real queue
  (greedy, no reordering), so estimates reflect the tool, not an ideal.
- **Framework-agnostic engine, Cypress-first product.** Only the input reader is
  tool-specific: it reads Cypress run results (Module API or **mochawesome**),
  auto-detected. The engine itself never changes — other readers stay parked in
  the code, one file away from a new runner.
- **Privacy by construction.** The web processes reports in the browser and
  never uploads them — proven by a dedicated E2E test.
- **Closes the loop to CI.** Every move ships the exact spec list per container,
  and `--format github|bitbucket` emits the full workflow where each parallel job
  runs its list and keeps its own report — ready to feed back in. See
  [examples/ci/](examples/ci).

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
