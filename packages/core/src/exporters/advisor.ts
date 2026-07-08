import { formatDuration } from './summary';
import type { AdvisorResult, CostModel, Scenario } from '../advisor/types';

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

const MOVE_LABEL: Record<Scenario['id'], (s: Scenario, currentShards: number) => string> = {
  rebalance: (_s, n) => `Rebalance your ${n} shards`,
  'same-feedback-cheaper': (s) => `Same wait, cheaper: ${s.config.shardCount} shards`,
  'same-cost-faster': (s) => `Same cost, faster: ${s.config.shardCount} shards`,
  objective: (s) => `By objective: ${s.config.shardCount} shards`,
};

/** Render an AdvisorResult as a plain-text report (spec §7.1). Deterministic. */
export function toAdvisorText(result: AdvisorResult, cost: CostModel): string {
  const { current, scenarios, findings, frontier } = result;
  const workers = frontier[0]?.workersPerShard ?? 1;
  const lines: string[] = [];

  lines.push('CI Shard Advisor', '================', '');
  lines.push(`Suite: ${result.tasks.length} tests, ${formatDuration(testTimeMs(result))} of test time`, '');

  lines.push(`Your current setup (${current.measured ? 'measured' : 'modeled'})`);
  lines.push(`  ${current.shardCount} shards × ${workers} worker${workers === 1 ? '' : 's'}`);
  const slowest = indexOfMax(current.shardTimesMs) + 1;
  lines.push(`  Feedback time: ${formatDuration(current.feedbackTimeMs)}   (slowest shard: #${slowest})`);
  const curMoney = money(current.costMs, cost);
  lines.push(`  Billed cost:   ${formatDuration(current.costMs)}${curMoney ? `  →  ${curMoney} per run` : ''}`);
  if (current.measured && current.imbalanceMs > 0) {
    const fastIdx = indexOfMin(current.shardTimesMs) + 1;
    lines.push(
      `  ⚠ Imbalance: shard #${fastIdx} finishes ${formatDuration(current.imbalanceMs)} before shard #${slowest}. You are paying for idle machines.`,
    );
  }
  lines.push('');

  lines.push('Your moves');
  scenarios.forEach((scenario, i) => {
    const label = MOVE_LABEL[scenario.id](scenario, current.shardCount);
    if (scenario.unavailable) {
      lines.push(`  ${i + 1}) ${label} — not available: ${scenario.reason}`);
      return;
    }
    if (scenario.sameAs) {
      const other = scenarios.findIndex((s) => s.id === scenario.sameAs) + 1;
      lines.push(`  ${i + 1}) ${label} — same as move #${other}.`);
      return;
    }
    const feedback = formatDuration(scenario.config.feedbackTimeMs);
    const df = scenario.vsCurrent ? ` (${signedDuration(scenario.vsCurrent.feedbackDeltaMs)})` : '';
    const c = money(scenario.config.costMs, cost) ?? formatDuration(scenario.config.costMs);
    const dc = scenario.vsCurrent
      ? ` (${signedMoney(scenario.vsCurrent.costDeltaMs, cost) ?? signedDuration(scenario.vsCurrent.costDeltaMs)})`
      : '';
    lines.push(`  ${i + 1}) ${label}   feedback ${feedback}${df}   cost ${c}${dc}`);
    lines.push(`     ${scenario.reason}`);
    if (scenario.plan?.shardWeights) {
      lines.push(`     Apply: npx playwright test --shard-weights=${scenario.plan.shardWeights}`);
    }
  });
  lines.push('');

  if (findings.warnings.length > 0) {
    lines.push('Warnings');
    for (const warning of findings.warnings) lines.push(`  • ${warning}`);
    lines.push('');
  }

  const hasPrice = cost.pricePerMinute !== undefined;
  lines.push(`Frontier (shards · feedback · billed${hasPrice ? ' · price' : ''})`);
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
    current: { ...result.current, price: withMoney(result.current.costMs) },
    scenarios: result.scenarios.map((s) => ({
      id: s.id,
      shardCount: s.config.shardCount,
      feedbackTimeMs: s.config.feedbackTimeMs,
      costMs: s.config.costMs,
      price: withMoney(s.config.costMs),
      vsCurrent: s.vsCurrent,
      reason: s.reason,
      shardWeights: s.plan?.shardWeights,
      sameAs: s.sameAs,
      unavailable: s.unavailable,
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
    `**${current.shardCount} shards** — ${formatDuration(current.feedbackTimeMs)} feedback, ${curMoney ?? formatDuration(current.costMs)} cost.`,
  );
  if (current.measured && current.imbalanceMs > 0) {
    md.push('', `Imbalance: ${formatDuration(current.imbalanceMs)} of idle machine time.`);
  }
  md.push('', '### Your moves', '');
  md.push('| Move | Shards | Feedback | Cost |', '| --- | ---: | ---: | ---: |');
  for (const s of scenarios) {
    const label = MOVE_LABEL[s.id](s, current.shardCount);
    if (s.unavailable) {
      md.push(`| ${label} | — | not available | |`);
      continue;
    }
    const note = s.sameAs ? ` (same as ${s.sameAs})` : '';
    const c = money(s.config.costMs, cost) ?? formatDuration(s.config.costMs);
    md.push(`| ${label}${note} | ${s.config.shardCount} | ${formatDuration(s.config.feedbackTimeMs)} | ${c} |`);
  }

  if (findings.warnings.length > 0) {
    md.push('', '### Warnings', '');
    for (const warning of findings.warnings) md.push(`- ${warning}`);
  }
  return md.join('\n');
}
