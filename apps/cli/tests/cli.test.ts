import { describe, expect, it } from 'vitest';
import { run } from '../src/cli';
import type { CliIO } from '../src/cli';

const pw = (durations: number[]): string =>
  JSON.stringify({
    suites: [
      {
        specs: durations.map((d, i) => ({
          title: `t${i}`,
          file: `t${i}.spec.ts`,
          tests: [{ status: 'expected', results: [{ duration: d }] }],
        })),
      },
    ],
  });

/** Run the CLI capturing output, with an in-memory file system. */
function invoke(args: string[], files: Record<string, string> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const readFile: CliIO['readFile'] = (path) => {
    if (path in files) return files[path];
    throw new Error('ENOENT');
  };
  const code = run(args, { readFile, stdout: (l) => out.push(l), stderr: (l) => err.push(l) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

// A shard that finishes early, and a shard with the slow work.
const twoShards = { 's1.json': pw([50000, 50000]), 's2.json': pw([10000, 10000]) };
// 6 shards, one holding a 60s bottleneck — heavily over-provisioned.
const overSharded: Record<string, string> = {
  's1.json': pw([60000]),
  's2.json': pw([5000]),
  's3.json': pw([5000]),
  's4.json': pw([5000]),
  's5.json': pw([5000]),
  's6.json': pw([5000]),
};

describe('cli', () => {
  describe('input & output', () => {
    it('reads one report per shard (measured) and prints the moves', () => {
      const { code, out } = invoke(['s1.json', 's2.json', '--setup', '30s'], twoShards);
      expect(code).toBe(0);
      expect(out).toContain('Your current setup (measured)');
      expect(out).toContain('Your moves');
      expect(out).toMatch(/--shard-weights=/);
    });

    it('models a single merged report with --shards', () => {
      const { out } = invoke(['all.json', '--shards', '2', '--setup', '30s'], { 'all.json': pw([50000, 50000, 10000, 10000]) });
      expect(out).toContain('(modeled)');
    });

    it('shows money with --price', () => {
      const { out } = invoke(['s1.json', 's2.json', '--setup', '30s', '--price', '0.1'], twoShards);
      expect(out).toMatch(/€\d+\.\d\d/);
    });

    it('prints JSON with --format json', () => {
      const { out } = invoke(['s1.json', 's2.json', '--setup', '30s', '--format', 'json'], twoShards);
      const parsed = JSON.parse(out);
      expect(parsed.current.measured).toBe(true);
      expect(Array.isArray(parsed.scenarios)).toBe(true);
    });

    it('emits CI config for the chosen scenario with --format github', () => {
      const { out } = invoke(['s1.json', 's2.json', '--setup', '30s', '--format', 'github'], twoShards);
      expect(out).toContain('strategy:');
      expect(out).toMatch(/--shard=\$\{\{ matrix\.shard \}\}\/\d+/);
    });
  });

  describe('usage & input errors (exit 2)', () => {
    it('errors when no report is given', () => {
      const { code, err } = invoke([]);
      expect(code).toBe(2);
      expect(err).toMatch(/at least one report/);
    });

    it('errors when a file cannot be read', () => {
      const { code, err } = invoke(['missing.json', '--setup', '30s']);
      expect(code).toBe(2);
      expect(err).toMatch(/cannot read/);
    });

    it('errors on mixed report formats', () => {
      const cypress = JSON.stringify({ runs: [{ spec: { relative: 'a.cy.ts' }, tests: [{ title: ['a'], state: 'passed', duration: 1000 }] }] });
      const { code, err } = invoke(['pw.json', 'cy.json', '--setup', '30s'], { 'pw.json': pw([1000]), 'cy.json': cypress });
      expect(code).toBe(2);
      expect(err).toMatch(/mixed report formats/);
    });

    it('errors on an invalid objective', () => {
      const { code, err } = invoke(['s1.json', 's2.json', '--objective', 'weird'], twoShards);
      expect(code).toBe(2);
      expect(err).toMatch(/--objective must be/);
    });
  });

  describe('quality gates (exit 1)', () => {
    it('fails when the best feedback exceeds --gate-feedback', () => {
      const { code, err } = invoke(['s1.json', 's2.json', '--setup', '30s', '--gate-feedback', '1ms'], twoShards);
      expect(code).toBe(1);
      expect(err).toMatch(/gate failed: best achievable feedback/);
    });

    it('fails when the current config wastes too much cost', () => {
      const { code, err } = invoke(
        ['s1.json', 's2.json', 's3.json', 's4.json', 's5.json', 's6.json', '--setup', '30s', '--gate-cost-waste', '20'],
        overSharded,
      );
      expect(code).toBe(1);
      expect(err).toMatch(/wastes .* cost/);
    });

    it('passes gates that are comfortably met', () => {
      const { code } = invoke(['s1.json', 's2.json', '--setup', '30s', '--gate-feedback', '10m', '--gate-cost-waste', '90'], twoShards);
      expect(code).toBe(0);
    });
  });
});
