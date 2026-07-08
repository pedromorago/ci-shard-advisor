import { formatDuration } from '@ci-shard-advisor/core';
import type { MeasuredCurrent } from '@ci-shard-advisor/core';
import { formatMoney } from './analysis';

interface CurrentCardProps {
  current: MeasuredCurrent;
  workersPerShard: number;
  pricePerMinute: number;
}

/** The team's situation today — measured from per-shard reports, or modeled. */
export function CurrentCard({ current, workersPerShard, pricePerMinute }: CurrentCardProps) {
  const money = formatMoney(current.costMs, pricePerMinute);
  const slowestShard = current.shardTimesMs.indexOf(Math.max(...current.shardTimesMs)) + 1;

  return (
    <section className="card" aria-labelledby="current-heading">
      <h2 id="current-heading">
        Your setup today <span className="tag">{current.measured ? 'measured' : 'modeled'}</span>
      </h2>
      <p className="recommendation__headline">
        <strong>{current.shardCount} shards</strong> × {workersPerShard} worker
        {workersPerShard === 1 ? '' : 's'}
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
          ⚠ Imbalance: {formatDuration(current.imbalanceMs)} of idle machine time (slowest is shard #{slowestShard}).
        </p>
      ) : null}
    </section>
  );
}
