import { formatDuration } from './summary';
import type { AdvisorResult, CostModel, Runner, Scenario } from '../advisor/types';

/** The machine word each runner's users say: Cypress containers, Playwright shards. */
export function unitOf(runner: Runner): string {
  return runner === 'cypress' ? 'container' : 'shard';
}

/** The real, runnable command for one shard's spec list. */
export function applyCommand(runner: Runner, specs: string[]): string {
  return runner === 'cypress'
    ? `npx cypress run --spec "${specs.join(',')}"`
    : `npx playwright test ${specs.join(' ')}`;
}

/** Total test time (sum of task durations). */
function testTimeMs(result: AdvisorResult): number {
  return result.tasks.reduce((sum, task) => sum + task.durationMs, 0);
}

/** Billed ms as money, or null when no price is set. */
function money(costMs: number, cost: CostModel): string | null {
  if (cost.pricePerMinute === undefined) return null;
  return `${cost.currency ?? '€'}${((costMs / 60_000) * cost.pricePerMinute).toFixed(2)}`;
}

/** Signed duration; 0 → ±0, negative (faster/cheaper) shows a minus. */
function signedDuration(ms: number): string {
  if (ms === 0) return '±0';
  return `${ms < 0 ? '−' : '+'}${formatDuration(Math.abs(ms))}`;
}

function signedMoney(ms: number, cost: CostModel): string | null {
  if (cost.pricePerMinute === undefined) return null;
  if (ms === 0) return '±0';
  return `${ms < 0 ? '−' : '+'}${money(Math.abs(ms), cost)}`;
}

function indexOfMax(values: number[]): number {
  let idx = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[idx]) idx = i;
  return idx;
}
function indexOfMin(values: number[]): number {
  let idx = 0;
  for (let i = 1; i < values.length; i++) if (values[i] < values[idx]) idx = i;
  return idx;
}

/** The label of the chosen move, from the objective that produced it. */
function objectiveLabel(scenario: Scenario): string {
  switch (scenario.objective?.kind) {
    case 'fastest':
      return 'Fastest';
    case 'max-feedback':
      return 'Within your wait';
    case 'budget':
      return 'Within your budget';
    case 'cheapest':
      return 'Cheapest';
    case 'weight':
      return 'Your weighting';
    default:
      return 'Recommended';
  }
}

/** The two scenarios the presentation shows: the free rebalance + the chosen move. */
function presentedMoves(scenarios: Scenario[]): { rebalance: Scenario; chosen: Scenario } {
  const rebalance = scenarios.find((s) => s.id === 'rebalance')!;
  const chosen = scenarios.find((s) => s.id === 'objective')!;
  return { rebalance, chosen };
}

/** True when the chosen move lands on the same config as the rebalance. */
function coincides(chosen: Scenario, rebalance: Scenario): boolean {
  return !chosen.unavailable && chosen.config.shardCount === rebalance.config.shardCount;
}

/** Render an AdvisorResult as a plain-text report (spec §7.1). Deterministic. */
export function toAdvisorText(result: AdvisorResult, cost: CostModel): string {
  const { current, scenarios, findings, frontier } = result;
  const workers = frontier[0]?.workersPerShard ?? 1;
  const lines: string[] = [];

  lines.push('CI Shard Advisor', '================', '');
  lines.push(`Suite: ${result.tasks.length} tests, ${formatDuration(testTimeMs(result))} of test time`, '');

  const unit = unitOf(result.runner);
  lines.push(`Your current setup (${current.measured ? 'measured' : 'modeled'})`);
  // Workers are a Playwright concept; Cypress containers run their specs serially.
  const machines = result.runner === 'cypress'
    ? `${current.shardCount} ${unit}${current.shardCount === 1 ? '' : 's'}`
    : `${current.shardCount} ${unit}s × ${workers} worker${workers === 1 ? '' : 's'}`;
  lines.push(`  ${machines}`);
  const slowest = indexOfMax(current.shardTimesMs) + 1;
  lines.push(`  Feedback time: ${formatDuration(current.feedbackTimeMs)}   (slowest ${unit}: #${slowest})`);
  const curMoney = money(current.costMs, cost);
  lines.push(`  Billed cost:   ${formatDuration(current.costMs)}${curMoney ? `  →  ${curMoney} per run` : ''}`);
  if (current.measured && current.imbalanceMs > 0) {
    const fastIdx = indexOfMin(current.shardTimesMs) + 1;
    lines.push(
      `  ⚠ Imbalance: ${unit} #${fastIdx} finishes ${formatDuration(current.imbalanceMs)} before ${unit} #${slowest}. You are paying for idle machines.`,
    );
  }
  lines.push('');

  lines.push('Your moves');
  const { rebalance, chosen } = presentedMoves(scenarios);
  const pushMove = (tag: string, scenario: Scenario, title: string) => {
    const feedback = formatDuration(scenario.config.feedbackTimeMs);
    const df = scenario.vsCurrent ? ` (${signedDuration(scenario.vsCurrent.feedbackDeltaMs)})` : '';
    const c = money(scenario.config.costMs, cost) ?? formatDuration(scenario.config.costMs);
    const dc = scenario.vsCurrent
      ? ` (${signedMoney(scenario.vsCurrent.costDeltaMs, cost) ?? signedDuration(scenario.vsCurrent.costDeltaMs)})`
      : '';
    lines.push(`  ${tag}) ${title}   feedback ${feedback}${df}   cost ${c}${dc}`);
    lines.push(`     ${scenario.reason}`);
    if (scenario.plan) {
      lines.push('     Apply (each machine runs its own list):');
      scenario.plan.specs.forEach((specs, i) => {
        lines.push(`       ${unit} ${i + 1}: ${applyCommand(result.runner, specs)}`);
      });
      lines.push('     (--format github or bitbucket emits the full CI config)');
    }
  };

  if (coincides(chosen, rebalance)) {
    // One entry: the chosen move IS the rebalance of your current shards.
    pushMove(objectiveLabel(chosen), chosen, `Rebalance your ${current.shardCount} ${unit}s — your best move is free`);
  } else {
    pushMove('Free', rebalance, `Rebalance your ${current.shardCount} ${unit}s`);
    if (chosen.unavailable) {
      lines.push(`  ${objectiveLabel(chosen)}) not available: ${chosen.reason}`);
    } else {
      pushMove(objectiveLabel(chosen), chosen, `${chosen.config.shardCount} ${unit}s`);
    }
  }
  lines.push('');

  if (findings.warnings.length > 0) {
    lines.push('Warnings');
    for (const warning of findings.warnings) lines.push(`  • ${warning}`);
    lines.push('');
  }

  const hasPrice = cost.pricePerMinute !== undefined;
  lines.push(`Frontier (${unit}s · feedback · billed${hasPrice ? ' · price' : ''})`);
  for (const point of frontier) {
    const m = money(point.costMs, cost);
    lines.push(
      `  ${String(point.shardCount).padStart(2)}  ${formatDuration(point.feedbackTimeMs).padEnd(9)}${formatDuration(point.costMs).padEnd(9)}${m ? ` ${m}` : ''}`,
    );
  }

  return lines.join('\n');
}

/** Render an AdvisorResult as a stable, machine-readable object. */
export function toAdvisorObject(result: AdvisorResult, cost: CostModel) {
  const withMoney = (costMs: number) => {
    const m = money(costMs, cost);
    return m === null ? undefined : m;
  };
  return {
    totalTests: result.tasks.length,
    testTimeMs: testTimeMs(result),
    runner: result.runner,
    current: { ...result.current, price: withMoney(result.current.costMs) },
    scenarios: result.scenarios.map((s) => ({
      id: s.id,
      shardCount: s.config.shardCount,
      feedbackTimeMs: s.config.feedbackTimeMs,
      costMs: s.config.costMs,
      price: withMoney(s.config.costMs),
      vsCurrent: s.vsCurrent,
      reason: s.reason,
      specs: s.plan?.specs,
      sameAs: s.sameAs,
      unavailable: s.unavailable,
      objective: s.objective,
    })),
    findings: result.findings,
    frontier: result.frontier.map((p) => ({ ...p, price: withMoney(p.costMs) })),
  };
}

/** Render an AdvisorResult as pretty JSON. */
export function toAdvisorJson(result: AdvisorResult, cost: CostModel): string {
  return JSON.stringify(toAdvisorObject(result, cost), null, 2);
}

/** Render an AdvisorResult as Markdown. */
export function toAdvisorMarkdown(result: AdvisorResult, cost: CostModel): string {
  const { current, scenarios, findings } = result;
  const md: string[] = [];
  md.push('## CI Shard Advisor', '');
  md.push(`**${result.tasks.length} tests · ${formatDuration(testTimeMs(result))} of test time**`, '');

  const curMoney = money(current.costMs, cost);
  md.push(`### Your setup today (${current.measured ? 'measured' : 'modeled'})`, '');
  md.push(
    `**${current.shardCount} ${unitOf(result.runner)}s** — ${formatDuration(current.feedbackTimeMs)} feedback, ${curMoney ?? formatDuration(current.costMs)} cost.`,
  );
  if (current.measured && current.imbalanceMs > 0) {
    md.push('', `Imbalance: ${formatDuration(current.imbalanceMs)} of idle machine time.`);
  }
  md.push('', '### Your moves', '');
  md.push('| Move | Machines | Feedback | Cost |', '| --- | ---: | ---: | ---: |');
  const { rebalance, chosen } = presentedMoves(scenarios);
  const row = (label: string, s: Scenario) => {
    const c = money(s.config.costMs, cost) ?? formatDuration(s.config.costMs);
    md.push(`| ${label} | ${s.config.shardCount} | ${formatDuration(s.config.feedbackTimeMs)} | ${c} |`);
  };
  if (coincides(chosen, rebalance)) {
    row(`${objectiveLabel(chosen)} — rebalance your ${current.shardCount} ${unitOf(result.runner)}s (free)`, chosen);
  } else {
    row(`Rebalance your ${current.shardCount} ${unitOf(result.runner)}s (free)`, rebalance);
    if (chosen.unavailable) {
      md.push(`| ${objectiveLabel(chosen)} | — | not available | |`);
    } else {
      row(objectiveLabel(chosen), chosen);
    }
  }

  if (findings.warnings.length > 0) {
    md.push('', '### Warnings', '');
    for (const warning of findings.warnings) md.push(`- ${warning}`);
  }
  return md.join('\n');
}
