import { describe, expect, it } from 'vitest';
import { buildScenarios, chooseObjective } from '../../src/advisor/scenarios';
import { computeFindings } from '../../src/advisor/findings';
import { advise } from '../../src/advisor/advise';
import { toAdvisorText, toAdvisorMarkdown } from '../../src/exporters/advisor';
import type { ConfigPoint } from '../../src/recommender/frontier';
import type { AdvisorResult, CostModel, MeasuredCurrent, ReportFile } from '../../src/advisor/types';
import type { AtomicTask } from '../../src/types/domain';

/** A synthetic frontier: cost rises and feedback falls with more shards. */
const point = (shardCount: number, feedbackTimeMs: number, costMs: number): ConfigPoint => ({
  shardCount,
  workersPerShard: 1,
  runTimeMs: feedbackTimeMs,
  feedbackTimeMs,
  costMs,
  optimal: true,
});
const FRONTIER: ConfigPoint[] = [point(1, 150000, 120000), point(2, 90000, 150000), point(3, 70000, 180000)];

const task = (id: string, durationMs: number): AtomicTask => ({
  id,
  title: id,
  file: `${id}.spec.ts`,
  durationMs,
  status: 'passed',
  retries: 0,
});
const TASKS: AtomicTask[] = [task('a', 40000), task('b', 30000), task('c', 20000), task('d', 10000)];

const cost: CostModel = { startupOverheadMs: 30000, pricePerMinute: 0.1, currency: '€' };
const file = (name: string, content: unknown): ReportFile => ({ name, content });
const pwReport = (durations: number[]): unknown => ({
  suites: [{ specs: durations.map((duration, i) => ({ title: `t${i}`, file: `t${i}.spec.ts`, tests: [{ status: 'expected', results: [{ duration }] }] })) }],
});

describe('chooseObjective — every objective kind', () => {
  it('fastest and cheapest hit the frontier extremes', () => {
    expect(chooseObjective(FRONTIER, { kind: 'fastest' }).shardCount).toBe(3);
    expect(chooseObjective(FRONTIER, { kind: 'cheapest' }).shardCount).toBe(1);
  });

  it('balanced returns a frontier point', () => {
    expect(FRONTIER).toContain(chooseObjective(FRONTIER, { kind: 'balanced' }));
  });

  it('max-feedback picks the cheapest within budget, else the fastest', () => {
    expect(chooseObjective(FRONTIER, { kind: 'max-feedback', feedbackMs: 100000 }).shardCount).toBe(2);
    // Nothing meets a 50s wait → fall back to the fastest available.
    expect(chooseObjective(FRONTIER, { kind: 'max-feedback', feedbackMs: 50000 }).shardCount).toBe(3);
  });

  it('budget picks the fastest within budget, else the cheapest', () => {
    expect(chooseObjective(FRONTIER, { kind: 'budget', costMs: 160000 }).shardCount).toBe(2);
    // Nothing fits a tiny budget → fall back to the cheapest.
    expect(chooseObjective(FRONTIER, { kind: 'budget', costMs: 100000 }).shardCount).toBe(1);
  });

  it('weight trades cost against feedback', () => {
    expect(chooseObjective(FRONTIER, { kind: 'weight', costPerFeedbackMinute: 0 }).shardCount).toBe(1); // cost only
    expect(chooseObjective(FRONTIER, { kind: 'weight', costPerFeedbackMinute: 1e9 }).shardCount).toBe(3); // feedback only
  });
});

describe('buildScenarios — unavailable branches', () => {
  // A current already faster and cheaper than the whole frontier: nothing beats it.
  const unbeatable: MeasuredCurrent = {
    shardCount: 3,
    shardTimesMs: [1, 1, 1],
    feedbackTimeMs: 1,
    costMs: 1,
    imbalanceMs: 0,
    measured: true,
  };

  it('marks same-feedback-cheaper and same-cost-faster unavailable', () => {
    const scenarios = buildScenarios(FRONTIER, unbeatable, TASKS, 1, { kind: 'fastest' });
    const cheaper = scenarios.find((s) => s.id === 'same-feedback-cheaper')!;
    const faster = scenarios.find((s) => s.id === 'same-cost-faster')!;
    expect(cheaper.unavailable).toBe(true);
    expect(faster.unavailable).toBe(true);
    // fastest coincides with the rebalance point at shard count 3.
    expect(scenarios.find((s) => s.id === 'objective')!.sameAs).toBe('rebalance');
  });

  it('words the budget and weight objective reasons', () => {
    const normal: MeasuredCurrent = { shardCount: 2, shardTimesMs: [90000, 90000], feedbackTimeMs: 120000, costMs: 200000, imbalanceMs: 0, measured: true };
    const budget = buildScenarios(FRONTIER, normal, TASKS, 1, { kind: 'budget', costMs: 160000 });
    expect(budget.find((s) => s.id === 'objective')!.reason).toMatch(/within your cost budget/);
    const weight = buildScenarios(FRONTIER, normal, TASKS, 1, { kind: 'weight', costPerFeedbackMinute: 5 });
    expect(weight.find((s) => s.id === 'objective')!.reason).toMatch(/trade-off for your weighting/);
  });
});

describe('advisor exporters — unavailable and sameAs rendering', () => {
  const unbeatable: MeasuredCurrent = { shardCount: 3, shardTimesMs: [1, 1, 1], feedbackTimeMs: 1, costMs: 1, imbalanceMs: 0, measured: true };
  const result: AdvisorResult = {
    current: unbeatable,
    scenarios: buildScenarios(FRONTIER, unbeatable, TASKS, 1, { kind: 'fastest' }),
    frontier: FRONTIER,
    findings: { warnings: [], flaky: [] },
    tasks: TASKS,
  };

  it('text merges the chosen move into the rebalance when they coincide', () => {
    // fastest lands on 3 shards = the rebalance point → one single entry.
    const text = toAdvisorText(result, cost);
    expect(text).toMatch(/Fastest\) Rebalance your 3 shards — your best move is free/);
    expect(text).not.toMatch(/Free\)/);
  });

  it('text shows rebalance + the unavailable chosen move separately', () => {
    // A budget nothing meets → the objective falls back to cheapest (1 shard ≠ 3).
    const scenarios = buildScenarios(FRONTIER, unbeatable, TASKS, 1, { kind: 'budget', costMs: 100000 });
    const text = toAdvisorText({ ...result, scenarios }, cost);
    expect(text).toMatch(/Free\) Rebalance your 3 shards/);
    expect(text).toMatch(/Within your budget\)/);
  });

  it('markdown renders the merged move row when they coincide', () => {
    const md = toAdvisorMarkdown(result, cost);
    expect(md).toMatch(/Fastest — rebalance your 3 shards \(free\)/);
  });

  it('labels every objective kind on the chosen move', () => {
    const labelFor = (objective: Parameters<typeof buildScenarios>[4]) =>
      toAdvisorText({ ...result, scenarios: buildScenarios(FRONTIER, unbeatable, TASKS, 1, objective) }, cost);
    expect(labelFor({ kind: 'max-feedback', feedbackMs: 10_000_000 })).toMatch(/Within your wait\)/);
    expect(labelFor({ kind: 'cheapest' })).toMatch(/Cheapest\)/);
    expect(labelFor({ kind: 'weight', costPerFeedbackMinute: 0 })).toMatch(/Your weighting\)/);
    expect(labelFor({ kind: 'balanced' })).toMatch(/Recommended\)/);
  });

  it('markdown renders rebalance + chosen as two rows when they differ', () => {
    const scenarios = buildScenarios(FRONTIER, unbeatable, TASKS, 1, { kind: 'cheapest' }); // 1 shard ≠ 3
    const md = toAdvisorMarkdown({ ...result, scenarios }, cost);
    expect(md).toMatch(/Rebalance your 3 shards \(free\)/);
    expect(md).toMatch(/\| Cheapest \| 1 \|/);
  });

  it('says the chosen move is not available instead of inventing one', () => {
    // Hand-built: an objective scenario flagged unavailable (defensive path).
    const rebalance = buildScenarios(FRONTIER, unbeatable, TASKS, 1, { kind: 'fastest' }).find((s) => s.id === 'rebalance')!;
    const unavailable = {
      id: 'objective' as const,
      config: rebalance.config,
      reason: 'Nothing fits that budget.',
      unavailable: true,
      objective: { kind: 'budget' as const, costMs: 1 },
    };
    const custom = { ...result, scenarios: [rebalance, unavailable] };
    expect(toAdvisorText(custom, cost)).toMatch(/Within your budget\) not available: Nothing fits/);
    expect(toAdvisorMarkdown(custom, cost)).toMatch(/\| Within your budget \| — \| not available \|/);
  });
});

describe('computeFindings — worded findings across branches', () => {
  const cur = (
    shardCount: number,
    feedbackTimeMs: number,
    costMs: number,
    extra: Partial<MeasuredCurrent> = {},
  ): MeasuredCurrent => ({ shardCount, shardTimesMs: [], feedbackTimeMs, costMs, imbalanceMs: 0, measured: false, ...extra });

  it('over-fragmentation: reports the wasted shards, with a time gain', () => {
    const plateauEarly = [point(1, 150000, 120000), point(2, 90000, 150000), point(3, 89000, 180000)];
    const { warnings } = computeFindings(plateauEarly, cur(3, 100000, 200000), TASKS, cost);
    expect(warnings.some((w) => /you only pay more/.test(w) && /−/.test(w))).toBe(true);
  });

  it('over-fragmentation: says "no faster" when extra shards buy no time', () => {
    const plateauEarly = [point(1, 150000, 120000), point(2, 90000, 150000), point(3, 89000, 180000)];
    const { warnings } = computeFindings(plateauEarly, cur(3, 90000, 200000), TASKS, cost);
    expect(warnings.some((w) => /no faster/.test(w))).toBe(true);
  });

  it('under-fragmentation: quotes the extra cost as money when priced', () => {
    const { warnings } = computeFindings(FRONTIER, cur(1, 150000, 120000), TASKS, cost);
    expect(warnings.some((w) => /cut the wait/.test(w) && /€/.test(w))).toBe(true);
  });

  it('floor: names the bottleneck by title when the file is unknown', () => {
    const plateauNow = [point(1, 100000, 120000), point(2, 99000, 150000), point(3, 98500, 180000)];
    const tasks = [task('big', 50000)];
    tasks[0].file = '';
    tasks[0].title = 'BigTest';
    const { warnings } = computeFindings(plateauNow, cur(1, 100000, 120000), tasks, cost);
    expect(warnings.some((w) => /'BigTest'/.test(w) && /sets the floor/.test(w))).toBe(true);
  });

  it('over-fragmentation tolerates a zero-cost plateau', () => {
    const freePlateau = [point(1, 150000, 0), point(2, 90000, 0), point(3, 89000, 0)];
    const { warnings } = computeFindings(freePlateau, cur(3, 100000, 50000), TASKS, cost);
    expect(warnings.some((w) => /you only pay more/.test(w))).toBe(true);
  });

  it('defaults the € symbol and pluralizes multiple flaky tests', () => {
    const flakyA: AtomicTask = { ...task('fa', 20000), retries: 1, status: 'flaky', wastedMs: 5000 };
    const flakyB: AtomicTask = { ...task('fb', 20000), retries: 2, status: 'flaky' }; // no wastedMs → ?? 0
    const priatedNoCurrency: CostModel = { startupOverheadMs: 0, pricePerMinute: 0.1 };
    const { warnings } = computeFindings(FRONTIER, cur(1, 150000, 120000), [flakyA, flakyB], priatedNoCurrency);
    expect(warnings.some((w) => /cut the wait/.test(w) && /€/.test(w))).toBe(true); // currency defaults to €
    expect(warnings.some((w) => /2 flaky tests wasted/.test(w))).toBe(true); // plural
  });

  it('handles a zero-feedback current without dividing by it', () => {
    // feedbackTimeMs === 0 takes the guarded branch and simply reports no gain.
    const { warnings } = computeFindings(FRONTIER, cur(1, 0, 120000), TASKS, cost);
    expect(warnings.every((w) => !/cut the wait/.test(w))).toBe(true);
  });

  it('imbalance and a single flaky test are both reported', () => {
    const flakyTask: AtomicTask = { ...task('f', 20000), retries: 1, status: 'flaky', wastedMs: 8000 };
    const { warnings, flaky } = computeFindings(
      FRONTIER,
      cur(2, 90000, 150000, { measured: true, imbalanceMs: 40000 }),
      [flakyTask],
      cost,
    );
    expect(warnings.some((w) => /paying for idle machines/.test(w))).toBe(true);
    expect(warnings.some((w) => /1 flaky test wasted/.test(w))).toBe(true);
    expect(flaky).toHaveLength(1);
  });
});

describe('advise — edge inputs', () => {
  it('rejects an empty per-shard input', () => {
    expect(() => advise({ kind: 'per-shard', reports: [] }, cost)).toThrow(/at least one report/);
  });

  it('defaults a merged report to one modeled shard', () => {
    const { current } = advise({ kind: 'merged', report: file('all', pwReport([50000, 30000])) }, cost);
    expect(current.measured).toBe(false);
    expect(current.shardCount).toBe(1);
  });

  it('warns about under-fragmentation when a single shard leaves speed on the table', () => {
    const { findings } = advise(
      { kind: 'merged', report: file('all', pwReport([60000, 60000, 60000, 60000])), currentShardCount: 1 },
      { startupOverheadMs: 5000 },
    );
    expect(findings.warnings.some((w) => /cut the wait/.test(w))).toBe(true);
  });
});
