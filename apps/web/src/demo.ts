import type { ReportFile } from '@ci-shard-advisor/core';

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
 * The preloaded demo — a realistic (sample) 3-container e-commerce run in the
 * Module API format: container 1 holds the slow checkout journey plus a flaky
 * test, so the advisor shows the imbalance, the flaky machine-time waste and
 * the `cypress run --spec` apply commands.
 */
export const DEMO_REPORTS: ReportFile[] = [
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
