# CI Shard Advisor

Analyze Playwright JSON reports and find the best CI sharding strategy based on execution time, workers and cost.

> **Status: early development.** Phase 1 is complete — the scheduling core (scheduler, worker simulator and cost/time recommender) is built and tested. Web UI, CLI and local API will follow.

## Why

Most teams pick their number of CI shards by gut feeling: "let's use 8 because the pipeline feels slow". More shards do reduce feedback time, but every shard adds startup overhead and billed minutes. At some point the extra cost stops paying for the seconds saved.

CI Shard Advisor answers that question with data: it reads a real Playwright report, models how shards and workers actually behave, builds a cost-time frontier and recommends the configuration where the trade-off makes sense.

## Architecture

Lightweight hexagonal architecture. A pure TypeScript core (parser, normalizer, classifier, branch-and-bound scheduler, worker simulator, recommender, exporters) with thin adapters on top: a static web UI, a CLI and an optional local API. The core knows nothing about React, HTTP or the command line.

```text
   Web (React/Vite)     CLI (Node)     Local API (Fastify)
          \                 |                 /
           v                v                v
                     packages/core
   parser -> normalizer -> classifier -> scheduler -> recommender -> exporters
```

See [docs/architecture.md](docs/architecture.md) for details.

## Development

Requires Node.js 22+ and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm test        # run all workspace tests
pnpm typecheck   # strict TypeScript checks
```

## Roadmap

- [x] Monorepo setup
- [x] Phase 1 — Scheduling core (LPT ✔, bounds ✔, branch and bound ✔, worker simulator ✔, frontier ✔)
- [ ] Phase 2 — Web demo with preloaded analysis
- [ ] Phase 3 — Full testing strategy (integration, privacy, visual, a11y)
- [ ] Phase 4 — CLI with quality-gate mode
- [ ] Phase 5 — Local API + Java REST Assured test suite
- [ ] Phase 6 — Portfolio polish (docs, GIF, badges)
