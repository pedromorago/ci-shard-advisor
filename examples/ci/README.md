# CI sharding examples

This is where CI Shard Advisor connects to real cloud execution. Sharding *is*
splitting a test run into N jobs that run in parallel — on separate, separately
billed machines — and collecting their reports.

```text
   ┌── shard 1/N ──┐
   ├── shard 2/N ──┤   each runs on its own runner (billed separately)
   ├──   …    ─────┤   → one report per shard
   └── shard N/N ──┘
              │
   one file per shard  ← CI Shard Advisor reads these
```

## Two ways to feed it (per-shard is better)

**Per-shard (preferred).** Keep one JSON report per shard. The advisor then
*measures* your real situation — the true time each shard took — so it can spot
**imbalance** (one shard finishing long before another, i.e. idle machines you
pay for). This is the v2 default.

- [`github-actions-per-shard.yml`](github-actions-per-shard.yml) — a `strategy.matrix`
  of N shards, each uploading its own `shard-i.json`. No merge job.

**Merged (fallback).** If you only have one combined report, the advisor still
works but *models* the split by test count — no per-shard times, no imbalance.

- [`github-actions.yml`](github-actions.yml) — N shards + a `merge-reports` job → `report.json`.
- [`bitbucket-pipelines.yml`](bitbucket-pipelines.yml) — N `parallel` steps + a merge step.

They live here (not in `.github/workflows/`) so they don't run in this repo.

## The loop

1. Run the workflow → download the `shard-*` artifacts (or the merged `report.json`).
2. Feed them to the advisor:

   ```bash
   # per-shard (measured): pass one file per shard
   ci-shard-advisor shard-1.json shard-2.json shard-3.json shard-4.json --setup 45s --price 0.008

   # merged (modeled): one report + how many shards you run today
   ci-shard-advisor report.json --setup 45s --shards 4
   ```

   …or drop the files into the web app's upload — it shows the same analysis.
3. It anchors to where you are today and shows your moves: rebalance for free,
   the same wait for less money, the same budget for less wait, and the
   objective you pick — each with what it costs or saves.

## Note on the split

`--shard=i/N` splits by test **count**, not duration — the runner does not
balance by duration natively. The advisor closes that gap by emitting the
**exact spec list each shard should run**: as per-shard commands on every move,
and as a full, paste-ready workflow via `--format github` or `--format
bitbucket`, where each parallel job runs exactly its list and keeps its own
report (ready to feed back to the advisor).
