import { formatDuration } from '@ci-shard-advisor/core';
import type { Scenario } from '@ci-shard-advisor/core';
import { formatMoney } from './analysis';

function signedDuration(ms: number): string {
  if (ms === 0) return '±0';
  return `${ms < 0 ? '−' : '+'}${formatDuration(Math.abs(ms))}`;
}

function signedMoney(ms: number, pricePerMinute: number): string | null {
  if (!pricePerMinute) return null;
  if (ms === 0) return '±0';
  return `${ms < 0 ? '−' : '+'}${formatMoney(Math.abs(ms), pricePerMinute)}`;
}

interface MoveCardProps {
  /** Short pill: "Free", "Recommended", "Fastest", … */
  tag: string;
  /** Headline: "Rebalance your 4 shards", "3 shards", … */
  title: string;
  scenario: Scenario;
  pricePerMinute: number;
}

/** One move: its numbers versus the current situation, why, and how to apply it. */
export function MoveCard({ tag, title, scenario, pricePerMinute }: MoveCardProps) {
  if (scenario.unavailable) {
    return (
      <li className="move move--muted">
        <div className="move__head">
          <span className="tag">{tag}</span>
          <span className="move__title">Not available</span>
        </div>
        <p className="move__reason">{scenario.reason}</p>
      </li>
    );
  }

  const cost = formatMoney(scenario.config.costMs, pricePerMinute) ?? formatDuration(scenario.config.costMs);
  const costDelta = scenario.vsCurrent
    ? signedMoney(scenario.vsCurrent.costDeltaMs, pricePerMinute) ?? signedDuration(scenario.vsCurrent.costDeltaMs)
    : null;

  return (
    <li className="move">
      <div className="move__head">
        <span className="tag">{tag}</span>
        <span className="move__title">{title}</span>
      </div>
      <p className="move__stats">
        {formatDuration(scenario.config.feedbackTimeMs)}
        {scenario.vsCurrent ? <em> ({signedDuration(scenario.vsCurrent.feedbackDeltaMs)})</em> : null}
        {' · '}
        {cost}
        {costDelta ? <em> ({costDelta})</em> : null}
      </p>
      <p className="move__reason">{scenario.reason}</p>
      {scenario.plan?.shardWeights ? (
        <code className="move__apply">--shard-weights={scenario.plan.shardWeights}</code>
      ) : null}
    </li>
  );
}
