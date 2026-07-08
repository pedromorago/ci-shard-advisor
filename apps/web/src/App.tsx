import { useMemo, useState } from 'react';
import { summarize, formatDuration } from '@ci-shard-advisor/core';
import { analyzeReport, DEFAULT_SETTINGS, DEMO_REPORT } from './analysis';
import type { AnalysisSettings, ReportInput } from './analysis';
import { ReportInput as ReportInputControl } from './ReportInput';
import { Controls } from './Controls';
import { FrontierChart } from './FrontierChart';

export function App() {
  const [report, setReport] = useState<ReportInput>(DEMO_REPORT);
  const [source, setSource] = useState('demo report');
  const [settings, setSettings] = useState<AnalysisSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);

  // Re-runs whenever the report or any setting changes. The report never leaves
  // the browser.
  const summary = useMemo(() => summarize(analyzeReport(report, settings)), [report, settings]);
  const { recommended, current, savings } = summary;

  function handleSelect(jsonText: string, fileName: string) {
    try {
      const result = analyzeReport(jsonText, settings);
      if (result.tasks.length === 0) {
        setError('That report has no tests to analyze.');
        return;
      }
      setReport(jsonText);
      setSource(fileName);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read that report.');
    }
  }

  function handleLoadDemo() {
    setReport(DEMO_REPORT);
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

      <ReportInputControl onSelect={handleSelect} onLoadDemo={handleLoadDemo} />

      {error ? (
        <p className="app__error" role="alert">
          {error}
        </p>
      ) : null}

      <p className="app__meta">
        Showing <strong>{source}</strong> · {summary.totalTests} tests ·{' '}
        {formatDuration(summary.totalDurationMs)} total
      </p>

      <Controls settings={settings} onChange={setSettings} />

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

      <section className="card" aria-labelledby="frontier-heading">
        <h2 id="frontier-heading">Cost / time frontier</h2>
        <FrontierChart
          frontier={summary.frontier}
          recommended={recommended}
          current={current}
        />
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
