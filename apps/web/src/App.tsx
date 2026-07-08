import { useMemo, useState } from 'react';
import { summarize, formatDuration } from '@ci-shard-advisor/core';
import { analyzeReport, DEFAULT_SETTINGS, DEMO_REPORT } from './analysis';
import type { AnalysisSettings, ReportInput } from './analysis';
import { ReportInput as ReportInputControl } from './ReportInput';
import { Controls } from './Controls';
import { CurrentPipeline } from './CurrentPipeline';
import { Recommendation } from './Recommendation';
import type { RecommendationMode } from './Recommendation';
import { CiConfig } from './CiConfig';
import { Explore } from './Explore';
import { FrontierChart } from './FrontierChart';

export function App() {
  const [report, setReport] = useState<ReportInput>(DEMO_REPORT);
  const [source, setSource] = useState('demo report');
  const [settings, setSettings] = useState<AnalysisSettings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<RecommendationMode>('same-shards');
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => summarize(analyzeReport(report, settings)), [report, settings]);
  const current = summary.current ?? summary.frontier[0];
  const balanced = summary.recommended;
  const sameShards = summary.frontier[Math.min(settings.currentShardCount, summary.frontier.length) - 1];
  const recommended = mode === 'same-shards' ? sameShards : balanced;

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
          Split your test pipeline to balance feedback time and cost.
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

      <CurrentPipeline current={current} ratePerMin={settings.costRatePerMin} />

      <Recommendation
        current={current}
        recommended={recommended}
        mode={mode}
        onModeChange={setMode}
        ratePerMin={settings.costRatePerMin}
      />

      <CiConfig shardCount={recommended.shardCount} />

      <Explore
        frontier={summary.frontier}
        ratePerMin={settings.costRatePerMin}
        initialShardCount={settings.currentShardCount}
      />

      <details className="card details">
        <summary>Show the full cost / time frontier</summary>
        <div className="details__body">
          <FrontierChart
            frontier={summary.frontier}
            recommended={balanced}
            current={current}
            ratePerMin={settings.costRatePerMin}
          />
        </div>
      </details>

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
