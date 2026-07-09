import type { ReportFile } from '@ci-shard-advisor/core';
import shard1 from './demo/shard-1.json';
import shard2 from './demo/shard-2.json';
import shard3 from './demo/shard-3.json';
import shard4 from './demo/shard-4.json';

/**
 * The Playwright demo — a *real* 4-shard run: a 14-test suite executed against
 * playwright.dev with `--shard=i/4`, one JSON report per shard. Because it is
 * real per-shard data the advisor measures the setup (and its imbalance) rather
 * than modelling it. The same files live in samples/playwright-dev-shards/.
 */
export const DEMO_PLAYWRIGHT: ReportFile[] = [
  { name: 'shard-1.json', content: shard1 },
  { name: 'shard-2.json', content: shard2 },
  { name: 'shard-3.json', content: shard3 },
  { name: 'shard-4.json', content: shard4 },
];

type CyTest = {
  title: string[];
  state: string;
  duration?: number;
  attempts: { state: string; duration: number }[];
};

function cyRun(relative: string, tests: CyTest[]): unknown {
  return { spec: { name: relative.split('/').pop(), relative }, tests };
}

function cyPass(suite: string, title: string, duration: number): CyTest {
  return { title: [suite, title], state: 'passed', duration, attempts: [{ state: 'passed', duration }] };
}

/** A retried pass: failed attempts burn machine time — the flaky finding. */
function cyFlaky(suite: string, title: string, wasted: number, final: number): CyTest {
  return {
    title: [suite, title],
    state: 'passed',
    duration: wasted + final,
    attempts: [
      { state: 'failed', duration: wasted },
      { state: 'passed', duration: final },
    ],
  };
}

/**
 * The Cypress demo — a realistic (sample) 3-container e-commerce run in the
 * Module API format: container 1 holds the slow checkout journey plus a flaky
 * test, so the advisor shows the imbalance, the flaky machine-time waste and
 * the `cypress run --spec` apply commands.
 */
export const DEMO_CYPRESS: ReportFile[] = [
  {
    name: 'container-1.json',
    content: {
      runs: [
        cyRun('cypress/e2e/checkout.cy.ts', [
          cyPass('Checkout', 'completes the full checkout journey', 95000),
          cyFlaky('Checkout', 'applies a discount code', 21000, 19000),
        ]),
      ],
    },
  },
  {
    name: 'container-2.json',
    content: {
      runs: [
        cyRun('cypress/e2e/login.cy.ts', [
          cyPass('Login', 'logs in with valid credentials @sanity', 18000),
          cyPass('Login', 'shows an error for a wrong password', 12000),
        ]),
        cyRun('cypress/e2e/search.cy.ts', [
          cyPass('Search', 'returns relevant results', 22000),
          cyPass('Search', 'filters by category', 14000),
        ]),
      ],
    },
  },
  {
    name: 'container-3.json',
    content: {
      runs: [
        cyRun('cypress/e2e/profile.cy.ts', [
          cyPass('Profile', 'updates the avatar', 16000),
          cyPass('Profile', 'saves notification settings', 9000),
        ]),
        cyRun('cypress/e2e/cart.cy.ts', [
          cyPass('Cart', 'adds and removes items', 20000),
        ]),
      ],
    },
  },
];
