import {
  applyCommand,
  formatDuration,
  formatMoney,
  signedDuration,
  signedMoney,
} from '@ci-shard-advisor/core';
import type { Runner, Scenario } from '@ci-shard-advisor/core';

interface MoveCardProps {
  /** Short pill: "Free", "Recommended", "Fastest", … */
  tag: string;
  /** Headline: "Rebalance your 4 shards", "3 shards", … */
  title: string;
  scenario: Scenario;
  pricePerMinute: number;
  /** Decides the apply command (playwright test … / cypress run --spec …). */
  runner: Runner;
}

/** One move: its numbers versus the current situation, why, and how to apply it. */
export function MoveCard({ tag, title, scenario, pricePerMinute, runner }: MoveCardProps) {
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
      {scenario.plan ? (
        <details className="move__plan">
          <summary>Apply this split — each machine runs its own list</summary>
          <ol className="move__plan-list">
            {scenario.plan.specs.map((specs, i) => (
              <li key={i}>
                <code className="move__apply">{applyCommand(runner, specs)}</code>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </li>
  );
}
