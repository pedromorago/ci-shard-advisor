import { formatDuration } from '@ci-shard-advisor/core';
import type { Scenario } from '@ci-shard-advisor/core';
import { formatMoney } from './analysis';

const LABELS: Record<Scenario['id'], string> = {
  rebalance: 'Rebalance',
  'same-feedback-cheaper': 'Same wait, cheaper',
  'same-cost-faster': 'Same cost, faster',
  objective: 'By objective',
};

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
  scenario: Scenario;
  moveNumber: number;
  pricePerMinute: number;
}

export function MoveCard({ scenario, moveNumber, pricePerMinute }: MoveCardProps) {
  const label = LABELS[scenario.id];

  if (scenario.unavailable) {
    return (
      <li className="move move--muted">
        <span className="move__title">{label}</span>
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
        <span className="move__num">{moveNumber}</span>
        <span className="move__title">
          {label} — <strong>{scenario.config.shardCount} shards</strong>
        </span>
      </div>
      {scenario.sameAs ? (
        <p className="move__same">Same configuration as “{LABELS[scenario.sameAs]}”.</p>
      ) : (
        <>
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
        </>
      )}
    </li>
  );
}
