import type { ReportFile } from '@ci-shard-advisor/core';

type Spec = [title: string, file: string, durationMs: number];

function shard(specs: Spec[]): unknown {
  return {
    suites: [
      {
        specs: specs.map(([title, file, duration]) => ({
          title,
          file,
          tests: [{ status: 'expected', results: [{ duration }] }],
        })),
      },
    ],
  };
}

/** A preloaded 4-shard run, deliberately unbalanced (shard 1 is the bottleneck). */
export const DEMO_REPORTS: ReportFile[] = [
  {
    name: 'shard-1.json',
    content: shard([
      ['the full checkout journey', 'checkout.spec.ts', 180000],
      ['adds an item to the cart', 'cart.spec.ts', 22000],
    ]),
  },
  {
    name: 'shard-2.json',
    content: shard([
      ['logs in with valid credentials', 'login.spec.ts', 34000],
      ['resets the password', 'login.spec.ts', 30000],
      ['returns search results', 'search.spec.ts', 25000],
    ]),
  },
  {
    name: 'shard-3.json',
    content: shard([
      ['exports a PDF report', 'export.spec.ts', 61000],
      ['exports a CSV report', 'export.spec.ts', 13000],
    ]),
  },
  {
    name: 'shard-4.json',
    content: shard([
      ['renders the dashboard', 'dashboard.spec.ts', 20000],
      ['creates an admin user', 'admin.spec.ts', 15000],
      ['saves settings', 'settings.spec.ts', 10000],
    ]),
  },
];
