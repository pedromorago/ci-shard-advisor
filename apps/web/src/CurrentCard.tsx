import { formatDuration, formatMoney, unitOf, unitsOf } from '@ci-shard-advisor/core';
import type { MeasuredCurrent, Runner } from '@ci-shard-advisor/core';

interface CurrentCardProps {
  current: MeasuredCurrent;
  pricePerMinute: number;
  /** Decides the machine word (Cypress containers, Playwright shards). */
  runner: Runner;
}

/** The team's situation today — measured from per-container reports, or modeled. */
export function CurrentCard({ current, pricePerMinute, runner }: CurrentCardProps) {
  const money = formatMoney(current.costMs, pricePerMinute);
  const slowestShard = current.shardTimesMs.indexOf(Math.max(...current.shardTimesMs)) + 1;

  return (
    <section className="card" aria-labelledby="current-heading">
      <h2 id="current-heading">
        Your setup today <span className="tag">{current.measured ? 'measured' : 'modeled'}</span>
      </h2>
      <p className="recommendation__headline">
        <strong>{unitsOf(current.shardCount, runner)}</strong>
      </p>
      <dl className="stats">
        <div className="stat">
          <dt>Feedback time</dt>
          <dd>{formatDuration(current.feedbackTimeMs)}</dd>
        </div>
        <div className="stat">
          <dt>Cost per run</dt>
          <dd>{money ?? formatDuration(current.costMs)}</dd>
        </div>
      </dl>
      {current.measured && current.imbalanceMs > 0 ? (
        <p className="current__imbalance">
          ⚠ Imbalance: {formatDuration(current.imbalanceMs)} of idle machine time (slowest is {unitOf(runner)} #{slowestShard}).
        </p>
      ) : null}
    </section>
  );
}
