# @ci-shard-advisor/cli

Command-line adapter. Reads the reports of your last sharded run and prints your
current situation plus the moves that improve it. Also acts as a CI quality gate.

## Usage

```bash
pnpm --filter @ci-shard-advisor/cli exec tsx src/bin.ts <reports...> [options]
```

Pass **one report per shard** (measured), or a **single merged report** with
`--shards N` (modeled).

| Option | Description |
| --- | --- |
| `--setup <duration>` | Per-shard startup overhead, e.g. `45s` (needed for cost) |
| `--price <num>` | Machine price per minute (adds money to every output) |
| `--workers <n>` | Workers per shard (default: 1) |
| `--shards <n>` | Declared shard count for a single merged report |
| `--objective <balanced\|fastest\|cheapest>` | The "by objective" move (default: `balanced`) |
| `--max-feedback <dur>` | Objective: cheapest within this feedback budget |
| `--budget <price\|dur>` | Objective: fastest within this cost budget |
| `--max-shards <n>` | Largest shard count to evaluate |
| `--format <text\|json\|markdown\|github\|bitbucket>` | Output (default: `text`) |
| `--input-format <auto\|playwright\|cypress\|mochawesome>` | Report format (default: `auto`) |

Quality gates (non-zero exit):

| Option | Description |
| --- | --- |
| `--gate-feedback <dur>` | Fail if the best achievable feedback exceeds the limit |
| `--gate-cost-waste <pct>` | Fail if your current config wastes more than `pct`% cost |

## Exit codes

`0` success · `1` a quality gate failed · `2` a usage or input error.

```bash
ci-shard-advisor artifacts/shard-*.json --setup 45s --price 0.08 \
  --gate-feedback 5m --gate-cost-waste 20
```
