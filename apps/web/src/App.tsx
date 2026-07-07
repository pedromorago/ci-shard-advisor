import { useMemo } from 'react';
import { analyze, summarize, formatDuration } from '@ci-shard-advisor/core';
import type { AnalyzeOptions } from '@ci-shard-advisor/core';
import demoReport from './demo-report.json';

/** Options for the preloaded demo analysis (ADR-005). */
const DEMO_OPTIONS: AnalyzeOptions = {
  maxShards: 8,
  startupOverheadMs: 30000,
  currentShardCount: 6,
};

export function App() {
  // The whole analysis runs in the browser — the report never leaves the tab.
  const summary = useMemo(() => summarize(analyze(demoReport, DEMO_OPTIONS)), []);
  const { recommended, current, savings } = summary;

  return (
    <main className="app">
      <header className="app__header">
        <h1>CI Shard Advisor</h1>
        <p className="app__tagline">
          Find the CI sharding strategy that balances feedback time and cost.
        </p>
      </header>

      <p className="app__meta">
        Analyzed <strong>{summary.totalTests} tests</strong> ·{' '}
        {formatDuration(summary.totalDurationMs)} total
      </p>

      <section className="card" aria-labelledby="recommendation-heading">
        <h2 id="recommendation-heading">Recommendation</h2>
        <p className="recommendation__headline">
          <strong>{recommended.shardCount} shards</strong> ×{' '}
          {recommended.workersPerShard} worker
          {recommended.workersPerShard === 1 ? '' : 's'}
        </p>
        <dl className="stats">
          <div className="stat">
            <dt>Feedback time</dt>
            <dd>{formatDuration(recommended.feedbackTimeMs)}</dd>
          </div>
          <div className="stat">
            <dt>Billed cost</dt>
            <dd>{formatDuration(recommended.costMs)}</dd>
          </div>
        </dl>
        {current && savings ? (
          <p className="recommendation__savings">
            vs your current {current.shardCount} shards: feedback{' '}
            {formatDuration(Math.abs(savings.timeSavedMs))}{' '}
            {savings.timeSavedMs >= 0 ? 'faster' : 'slower'}, cost{' '}
            {formatDuration(Math.abs(savings.costDeltaMs))}{' '}
            {savings.costDeltaMs <= 0 ? 'cheaper' : 'more expensive'}.
          </p>
        ) : null}
      </section>

      <section className="card" aria-labelledby="blocks-heading">
        <h2 id="blocks-heading">Blocks</h2>
        <table className="blocks">
          <thead>
            <tr>
              <th scope="col">Block</th>
              <th scope="col">Tests</th>
              <th scope="col">Duration</th>
            </tr>
          </thead>
          <tbody>
            {summary.blocks.map((block) => (
              <tr key={block.block}>
                <td>{block.block}</td>
                <td>{block.tests}</td>
                <td>{formatDuration(block.durationMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
