# @ci-shard-advisor/cli

Command-line adapter for CI Shard Advisor. Reads a Playwright JSON report,
prints a sharding recommendation, and can act as a **quality gate** in CI.

## Usage

```bash
pnpm --filter @ci-shard-advisor/cli start -- report.json [options]
```

Options:

| Option | Description |
| --- | --- |
| `--format <text\|json\|markdown>` | Output format (default: `text`) |
| `--input-format <playwright\|cypress>` | Report format (default: `playwright`) |
| `--shards <n>` | Your current shard count (enables the comparison) |
| `--workers <n>` | Workers per shard (default: 1) |
| `--overhead <duration>` | Per-shard startup overhead, e.g. `30s` |
| `--max-shards <n>` | Largest shard count to evaluate |
| `--max-feedback <duration>` | **Gate:** fail if the best feedback time exceeds this |
| `--max-cost-waste <pct>` | **Gate:** fail if your config wastes more than `pct`% cost |

Durations accept `ms`, `s` or `m` suffixes (a bare number is milliseconds).

## Exit codes

`0` success · `1` a quality gate failed · `2` a usage or input error.

Example CI gate — fail the build if feedback can't get under 5 minutes or the
current 8 shards waste more than 20% cost:

```bash
ci-shard-advisor report.json --shards 8 --overhead 30s \
  --max-feedback 5m --max-cost-waste 20
```
