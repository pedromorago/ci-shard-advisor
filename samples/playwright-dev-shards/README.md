# Real per-shard sample (Playwright — parked reader)

> The Playwright reader is parked: it stays in the code with its tests, but the
> product pitch is Cypress-only. This sample remains as the reader's fixture.

Four **real** Playwright JSON reports — one per shard — from a 14-test suite run
against [playwright.dev](https://playwright.dev) with `--shard=i/4`. This is the
input the advisor likes best: one file per shard, so it *measures* the true
per-shard times (and can see the imbalance) instead of modelling them.

Drop all four into the web app at once, or run:

```bash
ci-shard-advisor samples/playwright-dev-shards/shard-*.json --setup 45s --price 0.008
```

You'll see a *measured* 4-shard setup with a small imbalance, a free rebalance,
a cheaper 3-shard option at the same wait, and a floor set by the heaviest spec.

> Generated with `npx playwright test --shard=i/4 --reporter=json > shard-i.json`.
> The `config` block (local paths) was stripped; the `suites` the advisor reads
> are untouched.
