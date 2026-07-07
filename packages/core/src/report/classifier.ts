import type { AtomicTask } from '../types/domain';

export interface ClassifyRule {
  /** Block name assigned when this rule matches. */
  block: string;
  /** Match if the task carries any of these tags (leading '@' optional). */
  tags?: string[];
  /** Match if the task title or file matches this pattern. */
  pattern?: RegExp;
}

export interface ClassifyOptions {
  /** Rules tried in order; the first match wins. */
  rules?: ClassifyRule[];
  /** Block used when no rule matches. Defaults to 'regression'. */
  defaultBlock?: string;
}

/** Default ruleset: fast smoke tests form the 'sanity' block. */
const DEFAULT_RULES: ClassifyRule[] = [{ block: 'sanity', tags: ['@sanity', '@smoke'] }];

/** Normalize a tag for comparison: lower-case, without a leading '@'. */
function canonicalTag(tag: string): string {
  return tag.replace(/^@/, '').toLowerCase();
}

function ruleMatches(rule: ClassifyRule, task: AtomicTask): boolean {
  if (rule.tags && rule.tags.length > 0) {
    const wanted = new Set(rule.tags.map(canonicalTag));
    if ((task.tags ?? []).some((tag) => wanted.has(canonicalTag(tag)))) {
      return true;
    }
  }
  if (rule.pattern && rule.pattern.test(`${task.title} ${task.file}`)) {
    return true;
  }
  return false;
}

/**
 * Assign every task a block (sanity, regression, ...) by matching it against
 * an ordered ruleset — the first matching rule wins, otherwise the default
 * block applies. Returns new tasks; the input is not mutated.
 */
export function classify(
  tasks: readonly AtomicTask[],
  options: ClassifyOptions = {},
): AtomicTask[] {
  const rules = options.rules ?? DEFAULT_RULES;
  const defaultBlock = options.defaultBlock ?? 'regression';

  return tasks.map((task) => {
    const matched = rules.find((rule) => ruleMatches(rule, task));
    return { ...task, block: matched ? matched.block : defaultBlock };
  });
}
