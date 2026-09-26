import type { ReportFile } from '@ci-shard-advisor/core';
import container1 from '../../../samples/cypress-containers/container-1.json';
import container2 from '../../../samples/cypress-containers/container-2.json';
import container3 from '../../../samples/cypress-containers/container-3.json';

/**
 * The preloaded demo is the repository's own sample run
 * (samples/cypress-containers/), so the web, the CLI examples and the README
 * all tell the same story from one set of files: a realistic e-commerce suite
 * of 24 spec files and 109 tests, split by folder across 3 containers in the
 * Module API format.
 *
 * Container 1 carries checkout and admin, so it finishes 14 minutes after the
 * others: a free rebalance cuts the wait by more than 9 minutes. Four tests
 * pass only on retry (the flaky finding), and one guest-checkout spec is long
 * enough to set the floor past 7 containers (the "split it" finding).
 */
export const DEMO_REPORTS: ReportFile[] = [
  { name: 'container-1.json', content: container1 },
  { name: 'container-2.json', content: container2 },
  { name: 'container-3.json', content: container3 },
];
