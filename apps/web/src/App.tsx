import { useMemo, useState } from 'react';
import { summarize, formatDuration } from '@ci-shard-advisor/core';
import type { AnalysisResult } from '@ci-shard-advisor/core';
import { analyzeText, demoAnalysis } from './analysis';
import { ReportInput } from './ReportInput';

export function App() {
  const [analysis, setAnalysis] = useState<AnalysisResult>(() => demoAnalysis());
  const [source, setSource] = useState('demo report');
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => summarize(analysis), [analysis]);
  const { recommended, current, savings } = summary;

  function handleSelect(jsonText: string, fileName: string) {
    try {
      const result = analyzeText(jsonText);
      if (result.tasks.length === 0) {
        setError('That report has no tests to analyze.');
        return;
      }
      setAnalysis(result);
      setSource(fileName);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read that report.');
    }
  }

  function handleLoadDemo() {
    setAnalysis(demoAnalysis());
    setSource('demo report');
    setError(null);
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>CI Shard Advisor</h1>
        <p className="app__tagline">
          Find the CI sharding strategy that balances feedback time and cost.
        </p>
      </header>

      <ReportInput onSelect={handleSelect} onLoadDemo={handleLoadDemo} />

      {error ? (
        <p className="app__error" role="alert">
          {error}
        </p>
      ) : null}

      <p className="app__meta">
        Showing <strong>{source}</strong> · {summary.totalTests} tests ·{' '}
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
