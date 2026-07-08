import { formatDuration } from '@ci-shard-advisor/core';
import type { ConfigPoint } from '@ci-shard-advisor/core';
import { formatMoney } from './analysis';

interface CurrentPipelineProps {
  current: ConfigPoint;
  ratePerMin: number;
}

/**
 * The team's pipeline as it runs today: their shard count with a default even
 * (by test count) split, priced at the platform rate.
 */
export function CurrentPipeline({ current, ratePerMin }: CurrentPipelineProps) {
  return (
    <section className="card" aria-labelledby="current-heading">
      <h2 id="current-heading">Your pipeline today</h2>
      <p className="current__headline">
        {current.shardCount} shards × {current.workersPerShard} worker
        {current.workersPerShard === 1 ? '' : 's'}
        <span className="current__note"> (estimated with a default even split)</span>
      </p>
      <dl className="stats">
        <div className="stat">
          <dt>Validation time</dt>
          <dd>{formatDuration(current.feedbackTimeMs)}</dd>
        </div>
        <div className="stat">
          <dt>Cost per run</dt>
          <dd>{formatMoney(current.costMs, ratePerMin)}</dd>
        </div>
      </dl>
    </section>
  );
}
