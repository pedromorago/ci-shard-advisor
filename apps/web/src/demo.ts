import type { ReportFile } from '@ci-shard-advisor/core';
import shard1 from './demo/shard-1.json';
import shard2 from './demo/shard-2.json';
import shard3 from './demo/shard-3.json';
import shard4 from './demo/shard-4.json';

/**
 * A preloaded, *real* 4-shard run: a 14-test Playwright suite executed against
 * playwright.dev with `--shard=i/4`, one JSON report per shard. Because it is
 * real per-shard data the advisor measures the setup (and its imbalance) rather
 * than modelling it. The same files live in samples/playwright-dev-shards/.
 */
export const DEMO_REPORTS: ReportFile[] = [
  { name: 'shard-1.json', content: shard1 },
  { name: 'shard-2.json', content: shard2 },
  { name: 'shard-3.json', content: shard3 },
  { name: 'shard-4.json', content: shard4 },
];
