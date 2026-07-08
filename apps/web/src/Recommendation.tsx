import { formatDuration } from '@ci-shard-advisor/core';
import type { ConfigPoint } from '@ci-shard-advisor/core';
import { formatMoney } from './analysis';

export type RecommendationMode = 'same-shards' | 'balanced';

interface RecommendationProps {
  current: ConfigPoint;
  /** The chosen recommendation (depends on the mode). */
  recommended: ConfigPoint;
  mode: RecommendationMode;
  onModeChange: (mode: RecommendationMode) => void;
  ratePerMin: number;
}

export function Recommendation({
  current,
  recommended,
  mode,
  onModeChange,
  ratePerMin,
}: RecommendationProps) {
  const timeSavedMs = current.feedbackTimeMs - recommended.feedbackTimeMs;
  const costDeltaMs = recommended.costMs - current.costMs;

  return (
    <section className="card" aria-labelledby="recommendation-heading">
      <h2 id="recommendation-heading">Recommendation</h2>

      <div className="modes" role="group" aria-label="What to optimize for">
        <button
          type="button"
          className={mode === 'same-shards' ? 'mode mode--active' : 'mode'}
          aria-pressed={mode === 'same-shards'}
          onClick={() => onModeChange('same-shards')}
        >
          Same shards, faster
        </button>
        <button
          type="button"
          className={mode === 'balanced' ? 'mode mode--active' : 'mode'}
          aria-pressed={mode === 'balanced'}
          onClick={() => onModeChange('balanced')}
        >
          Best balance
        </button>
      </div>
      <p className="modes__hint">
        {mode === 'same-shards'
          ? 'Keep your container count and cost — just split by duration instead of by count.'
          : 'Trade a little cost for a big cut in feedback time (the sweet spot).'}
      </p>

      <p className="recommendation__headline">
        <strong>{recommended.shardCount} shards</strong> × {recommended.workersPerShard} worker
        {recommended.workersPerShard === 1 ? '' : 's'}
      </p>
      <dl className="stats">
        <div className="stat">
          <dt>Validation time</dt>
          <dd>{formatDuration(recommended.feedbackTimeMs)}</dd>
        </div>
        <div className="stat">
          <dt>Cost per run</dt>
          <dd>{formatMoney(recommended.costMs, ratePerMin)}</dd>
        </div>
      </dl>

      <p className="recommendation__savings">
        vs today: {formatDuration(Math.abs(timeSavedMs))} {timeSavedMs >= 0 ? 'faster' : 'slower'},{' '}
        {formatMoney(Math.abs(costDeltaMs), ratePerMin)} {costDeltaMs <= 0 ? 'cheaper' : 'more'} per run.
      </p>
    </section>
  );
}
