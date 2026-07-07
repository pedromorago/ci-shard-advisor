import { describe, expect, it } from 'vitest';
import { parseReport } from '../../src/report/parser';
import { durationsOf, normalize } from '../../src/report/normalizer';

/** Parse then normalize, the way the pipeline actually runs. */
function tasksFrom(raw: unknown) {
  return normalize(parseReport(raw));
}

describe('normalize', () => {
  it('turns a single test into one task', () => {
    const [task] = tasksFrom({
      suites: [
        {
          file: 'a.spec.ts',
          specs: [
            {
              title: 'does a thing',
              file: 'a.spec.ts',
              tests: [{ projectName: 'chromium', status: 'expected', results: [{ duration: 800 }] }],
            },
          ],
        },
      ],
    });
    expect(task).toMatchObject({
      title: 'does a thing',
      file: 'a.spec.ts',
      durationMs: 800,
      status: 'passed',
      retries: 0,
      project: 'chromium',
    });
  });

  it('sums retry attempts into the duration and counts retries', () => {
    const [task] = tasksFrom({
      suites: [
        {
          specs: [
            {
              title: 'flaky one',
              file: 'b.spec.ts',
              tests: [
                {
                  status: 'flaky',
                  results: [
                    { duration: 100, retry: 0 },
                    { duration: 120, retry: 1 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(task.durationMs).toBe(220);
    expect(task.retries).toBe(1);
    expect(task.status).toBe('flaky');
  });

  it('emits one task per project for a multi-project spec', () => {
    const tasks = tasksFrom({
      suites: [
        {
          specs: [
            {
              title: 'runs everywhere',
              file: 'c.spec.ts',
              tests: [
                { projectName: 'chromium', status: 'expected', results: [{ duration: 10 }] },
                { projectName: 'firefox', status: 'unexpected', results: [{ duration: 20 }] },
              ],
            },
          ],
        },
      ],
    });
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.project)).toEqual(['chromium', 'firefox']);
    expect(tasks.map((t) => t.status)).toEqual(['passed', 'failed']);
  });

  it('walks nested suites and inherits the suite file', () => {
    const tasks = tasksFrom({
      suites: [
        {
          file: 'group.spec.ts',
          specs: [{ title: 'top level', tests: [{ results: [{ duration: 5 }] }] }],
          suites: [
            {
              file: 'group.spec.ts',
              specs: [{ title: 'nested', tests: [{ results: [{ duration: 7 }] }] }],
            },
          ],
        },
      ],
    });
    expect(tasks.map((t) => t.title)).toEqual(['top level', 'nested']);
    // The nested spec has no file of its own; it inherits the suite's.
    expect(tasks[1].file).toBe('group.spec.ts');
  });

  it('maps a skipped test', () => {
    const [task] = tasksFrom({
      suites: [{ specs: [{ title: 's', tests: [{ status: 'skipped', results: [{ duration: 0 }] }] }] }],
    });
    expect(task.status).toBe('skipped');
  });

  it('returns no tasks for an empty report', () => {
    expect(tasksFrom({ suites: [] })).toEqual([]);
  });

  it('durationsOf extracts the schedulable durations', () => {
    const tasks = tasksFrom({
      suites: [
        {
          specs: [
            { title: 'x', tests: [{ results: [{ duration: 30 }] }] },
            { title: 'y', tests: [{ results: [{ duration: 12 }] }] },
          ],
        },
      ],
    });
    expect(durationsOf(tasks)).toEqual([30, 12]);
  });
});
