/**
 * Generate ready-to-paste CI config that shards a Playwright run across N jobs
 * and merges the blob reports back into the JSON this tool reads — closing the
 * loop from recommendation to real cloud execution.
 *
 * Note: `--shard=i/N` splits by test *count*, so the generated config gives you
 * the recommended shard *count*; duration-optimal per-shard weighting is a
 * separate concern the tool reports but the runner does not apply natively.
 */

function assertShardCount(shardCount: number): void {
  if (!Number.isInteger(shardCount) || shardCount < 1) {
    throw new RangeError(`shardCount must be an integer >= 1, got ${shardCount}`);
  }
}

/** GitHub Actions workflow: a matrix of N shards + a merge-reports job. */
export function toGitHubActions(shardCount: number): string {
  assertShardCount(shardCount);
  const shards = Array.from({ length: shardCount }, (_, i) => i + 1).join(', ');
  return `name: Playwright Tests
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    name: Shard \${{ matrix.shard }}/${shardCount}
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [${shards}]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps
      - name: Run shard \${{ matrix.shard }}/${shardCount}
        run: npx playwright test --shard=\${{ matrix.shard }}/${shardCount} --reporter=blob
      - name: Upload blob report
        if: \${{ !cancelled() }}
        uses: actions/upload-artifact@v4
        with:
          name: blob-report-\${{ matrix.shard }}
          path: blob-report/
          retention-days: 1
  merge-report:
    name: Merge into report.json
    if: \${{ !cancelled() }}
    needs: [test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Download blob reports
        uses: actions/download-artifact@v4
        with:
          path: all-blob-reports
          pattern: blob-report-*
          merge-multiple: true
      - name: Merge reports
        run: npx playwright merge-reports --reporter json ./all-blob-reports > report.json
      - name: Upload report.json (feed it to CI Shard Advisor)
        uses: actions/upload-artifact@v4
        with:
          name: playwright-json-report
          path: report.json
          retention-days: 7
`;
}

/** Bitbucket Pipelines: N parallel shard steps + a merge step. */
export function toBitbucketPipelines(shardCount: number): string {
  assertShardCount(shardCount);
  const shardSteps = Array.from({ length: shardCount }, (_, i) => i + 1)
    .map(
      (shard) => `        - step:
            name: Tests (shard ${shard}/${shardCount})
            script:
              - npm ci
              - npx playwright install --with-deps
              - npx playwright test --shard=${shard}/${shardCount} --reporter=blob
            artifacts:
              - blob-report/**`,
    )
    .join('\n');

  return `image: node:20
pipelines:
  default:
    - parallel:
${shardSteps}
    - step:
        name: Merge into report.json
        script:
          - npm ci
          # Blob reports from every shard are collected here as artifacts.
          - npx playwright merge-reports --reporter json ./blob-report > report.json
        artifacts:
          - report.json
`;
}
