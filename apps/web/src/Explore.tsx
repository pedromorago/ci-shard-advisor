import { useState } from 'react';
import { formatDuration } from '@ci-shard-advisor/core';
import type { ConfigPoint } from '@ci-shard-advisor/core';
import { formatMoney } from './analysis';

interface ExploreProps {
  frontier: ConfigPoint[];
  ratePerMin: number;
  initialShardCount: number;
}

/** Let the user drag the container count and watch time and cost react. */
export function Explore({ frontier, ratePerMin, initialShardCount }: ExploreProps) {
  const maxShards = frontier.length;
  const [shardCount, setShardCount] = useState(Math.min(initialShardCount, maxShards));
  const point = frontier[shardCount - 1];

  return (
    <section className="card" aria-labelledby="explore-heading">
      <h2 id="explore-heading">Explore container counts</h2>
      <label className="explore__control">
        <span>Containers: {shardCount}</span>
        <input
          type="range"
          min={1}
          max={maxShards}
          step={1}
          value={shardCount}
          onChange={(e) => setShardCount(Number(e.target.value))}
        />
      </label>
      <dl className="stats">
        <div className="stat">
          <dt>Validation time</dt>
          <dd>{formatDuration(point.feedbackTimeMs)}</dd>
        </div>
        <div className="stat">
          <dt>Cost per run</dt>
          <dd>{formatMoney(point.costMs, ratePerMin)}</dd>
        </div>
      </dl>
    </section>
  );
}
