import { describe, expect, it } from 'vitest';
import { run } from '../src/cli';
import type { CliIO } from '../src/cli';

const REPORT = JSON.stringify({
  suites: [
    {
      specs: [
        { title: 'a', tags: ['@sanity'], tests: [{ status: 'expected', results: [{ duration: 10000 }] }] },
        { title: 'b', tests: [{ status: 'expected', results: [{ duration: 20000 }] }] },
        { title: 'c', tests: [{ status: 'expected', results: [{ duration: 30000 }] }] },
        { title: 'd', tests: [{ status: 'expected', results: [{ duration: 40000 }] }] },
      ],
    },
  ],
});

const FILE = 'report.json';

/** Invoke the CLI capturing output, with a configurable file reader. */
function invoke(args: string[], readFile: CliIO['readFile'] = () => REPORT) {
  const out: string[] = [];
  const err: string[] = [];
  const code = run(args, {
    readFile,
    stdout: (line) => out.push(line),
    stderr: (line) => err.push(line),
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('cli', () => {
  describe('output formats', () => {
    it('prints a text report by default and exits 0', () => {
      const { code, out } = invoke([FILE]);
      expect(code).toBe(0);
      expect(out).toContain('CI Shard Advisor');
      expect(out).toContain('Recommended:');
    });

    it('prints JSON with --format json', () => {
      const { code, out } = invoke([FILE, '--format', 'json']);
      expect(code).toBe(0);
      const parsed = JSON.parse(out);
      expect(parsed.recommended.shardCount).toBeGreaterThanOrEqual(1);
    });

    it('prints Markdown with --format markdown', () => {
      const { out } = invoke([FILE, '--format', 'markdown']);
      expect(out).toContain('## CI Shard Advisor');
    });

    it('analyzes a Cypress report with --input-format cypress', () => {
      const cypress = JSON.stringify({
        runs: [
          {
            spec: { relative: 'a.cy.ts' },
            tests: [
              { title: ['A', 't1'], state: 'passed', duration: 10000 },
              { title: ['A', 't2'], state: 'passed', duration: 20000 },
            ],
          },
        ],
      });
      const { code, out } = invoke([FILE, '--input-format', 'cypress'], () => cypress);
      expect(code).toBe(0);
      expect(out).toContain('2 tests');
    });

    it('auto-detects and analyzes a JUnit XML report', () => {
      const junit =
        '<testsuites><testsuite name="s"><testcase name="t1" time="1"/><testcase name="t2" time="2"/></testsuite></testsuites>';
      const { code, out } = invoke([FILE], () => junit);
      expect(code).toBe(0);
      expect(out).toContain('2 tests');
    });

    it('errors on an unknown input format', () => {
      const { code, err } = invoke([FILE, '--input-format', 'jest']);
      expect(code).toBe(2);
      expect(err).toMatch(/unknown input format/);
    });
  });

  describe('usage and input errors (exit 2)', () => {
    it('errors when the report file is missing', () => {
      const { code, err } = invoke([]);
      expect(code).toBe(2);
      expect(err).toMatch(/missing report file/);
    });

    it('errors when the file cannot be read', () => {
      const { code, err } = invoke([FILE], () => {
        throw new Error('ENOENT');
      });
      expect(code).toBe(2);
      expect(err).toMatch(/cannot read/);
    });

    it('errors on a malformed report', () => {
      const { code, err } = invoke([FILE], () => '{ not json');
      expect(code).toBe(2);
      expect(err).toMatch(/error:/);
    });

    it('errors on an unknown format', () => {
      const { code, err } = invoke([FILE, '--format', 'yaml']);
      expect(code).toBe(2);
      expect(err).toMatch(/unknown format/);
    });

    it('errors on an invalid numeric option', () => {
      const { code, err } = invoke([FILE, '--workers', 'lots']);
      expect(code).toBe(2);
      expect(err).toMatch(/--workers must be a positive integer/);
    });

    it('prints help and exits 0', () => {
      const { code, out } = invoke(['--help']);
      expect(code).toBe(0);
      expect(out).toMatch(/Quality gate/);
    });
  });

  describe('quality gate (exit 1 on failure)', () => {
    it('fails when the best feedback time exceeds the budget', () => {
      const { code, err } = invoke([FILE, '--max-feedback', '1ms']);
      expect(code).toBe(1);
      expect(err).toMatch(/gate failed: best feedback time/);
    });

    it('passes when the feedback budget is comfortable', () => {
      const { code } = invoke([FILE, '--max-feedback', '10m']);
      expect(code).toBe(0);
    });

    it('fails when the current config wastes too much cost', () => {
      // 8 shards on a 4-test suite over-provisions: cheaper configs exist.
      const { code, err } = invoke([
        FILE,
        '--shards',
        '8',
        '--overhead',
        '30s',
        '--max-cost-waste',
        '0',
      ]);
      expect(code).toBe(1);
      expect(err).toMatch(/wastes .* cost vs recommended/);
    });

    it('passes the cost gate when the waste is within the limit', () => {
      const { code } = invoke([FILE, '--shards', '8', '--overhead', '30s', '--max-cost-waste', '100']);
      expect(code).toBe(0);
    });
  });
});
