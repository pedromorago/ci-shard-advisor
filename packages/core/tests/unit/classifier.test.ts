import { describe, expect, it } from 'vitest';
import { classify } from '../../src/report/classifier';
import type { AtomicTask } from '../../src/types/domain';

function task(overrides: Partial<AtomicTask> = {}): AtomicTask {
  return {
    id: overrides.id ?? 't',
    title: overrides.title ?? 'a test',
    file: overrides.file ?? 'a.spec.ts',
    durationMs: overrides.durationMs ?? 100,
    status: overrides.status ?? 'passed',
    retries: overrides.retries ?? 0,
    ...overrides,
  };
}

describe('classify', () => {
  describe('default ruleset', () => {
    it('puts @sanity and @smoke tagged tests in the sanity block', () => {
      const tasks = classify([
        task({ tags: ['@sanity'] }),
        task({ tags: ['@smoke'] }),
        task({ tags: ['@slow'] }),
        task({}),
      ]);
      expect(tasks.map((t) => t.block)).toEqual([
        'sanity',
        'sanity',
        'regression',
        'regression',
      ]);
    });

    it('matches tags case-insensitively and with or without a leading @', () => {
      const [a, b] = classify([task({ tags: ['Sanity'] }), task({ tags: ['@SMOKE'] })]);
      expect(a.block).toBe('sanity');
      expect(b.block).toBe('sanity');
    });
  });

  describe('custom rules', () => {
    it('matches on a title/file pattern', () => {
      const tasks = classify([task({ file: 'e2e/checkout.spec.ts' }), task({ file: 'unit/util.spec.ts' })], {
        rules: [{ block: 'e2e', pattern: /e2e\// }],
        defaultBlock: 'other',
      });
      expect(tasks.map((t) => t.block)).toEqual(['e2e', 'other']);
    });

    it('applies the first matching rule (order matters)', () => {
      const tasks = classify([task({ tags: ['@sanity'], file: 'e2e/login.spec.ts' })], {
        rules: [
          { block: 'e2e', pattern: /e2e\// },
          { block: 'sanity', tags: ['@sanity'] },
        ],
      });
      expect(tasks[0].block).toBe('e2e');
    });

    it('falls back to the default block when nothing matches', () => {
      const [t] = classify([task({})], { rules: [{ block: 'x', tags: ['@x'] }], defaultBlock: 'rest' });
      expect(t.block).toBe('rest');
    });
  });

  it('does not mutate the input tasks', () => {
    const input = task({ tags: ['@sanity'] });
    const before = { ...input };
    classify([input]);
    expect(input).toEqual(before);
    expect(input.block).toBeUndefined();
  });
});
