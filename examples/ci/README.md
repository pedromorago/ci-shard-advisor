# CI sharding examples

This is where CI Shard Advisor connects to real cloud execution. Sharding *is*
splitting a test run into N jobs that run in parallel — on separate, separately
billed machines — and merging their reports back into one.

```text
   ┌── shard 1/N ──┐
   ├── shard 2/N ──┤   each runs on its own runner (billed separately)
   ├──   …    ─────┤   → blob-report artifacts
   └── shard N/N ──┘
              │
           merge-reports → report.json  ← CI Shard Advisor reads this
```

These templates shard a **Playwright** suite and produce the merged `report.json`
you then feed back to the advisor:

- [`github-actions.yml`](github-actions.yml) — a `strategy.matrix` of N shards + a merge job.
- [`bitbucket-pipelines.yml`](bitbucket-pipelines.yml) — N `parallel` steps + a merge step.

They live here (not in `.github/workflows/`) so they don't run in this repo.

## The loop

1. Run this workflow → get `report.json`.
2. Feed it to the advisor (web upload, `ci-shard-advisor report.json`, or the API).
3. It recommends the shard count **N** where more shards stop paying off.
4. Regenerate the config for that N — the tool emits it directly:

   ```bash
   ci-shard-advisor report.json --overhead 30s --format github     # or: bitbucket
   ```

   or copy it from the web app's **"Set it up in CI"** panel.

## Note on the split

`--shard=i/N` splits by test **count**, not duration. So the config gives you
the recommended shard **count** (the bulk of the value). Making each shard equal
in **duration** needs per-shard weighting, which the advisor reports separately —
the runner does not apply it natively.
