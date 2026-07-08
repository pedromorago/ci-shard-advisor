import { useMemo, useState } from 'react';
import { formatDuration } from '@ci-shard-advisor/core';
import type { ReportFile } from '@ci-shard-advisor/core';
import { adviseFrom, DEFAULT_SETTINGS, DEMO_REPORTS } from './analysis';
import type { AnalysisSettings } from './analysis';
import { ReportInput } from './ReportInput';
import { ReportHelp } from './ReportHelp';
import { Controls } from './Controls';
import { CurrentCard } from './CurrentCard';
import { MoveCard } from './MoveCard';
import { FindingsCard } from './FindingsCard';
import { FrontierChart } from './FrontierChart';

export function App() {
  const [reports, setReports] = useState<ReportFile[]>(DEMO_REPORTS);
  const [source, setSource] = useState('demo · playwright.dev (4 shards)');
  const [settings, setSettings] = useState<AnalysisSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => adviseFrom(reports, settings), [reports, settings]);
  const testTimeMs = useMemo(
    () => result.tasks.reduce((sum, task) => sum + task.durationMs, 0),
    [result],
  );
  // The presentation (spec §5.2): the free rebalance + the chosen move.
  const rebalance = result.scenarios.find((s) => s.id === 'rebalance')!;
  const chosen = result.scenarios.find((s) => s.id === 'objective')!;
  const merged = !chosen.unavailable && chosen.config.shardCount === rebalance.config.shardCount;
  const OBJECTIVE_LABEL: Record<AnalysisSettings['objective']['kind'], string> = {
    recommended: 'Recommended',
    fastest: 'Fastest',
    'max-wait': 'Within your wait',
    budget: 'Within your budget',
  };
  const chosenLabel = OBJECTIVE_LABEL[settings.objective.kind];

  function handleSelect(uploaded: ReportFile[]) {
    try {
      const preview = adviseFrom(uploaded, settings);
      if (preview.tasks.length === 0) {
        setError('Those reports have no tests to analyze.');
        return;
      }
      setReports(uploaded);
      setSource(uploaded.length >= 2 ? `${uploaded.length} uploaded reports` : uploaded[0].name);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read those reports.');
    }
  }

  function handleLoadDemo() {
    setReports(DEMO_REPORTS);
    setSource('demo · playwright.dev (4 shards)');
    setError(null);
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>CI Shard Advisor</h1>
        <p className="app__tagline">
          You are here — these are your moves and what each one costs or saves.
        </p>
      </header>

      <ReportInput onSelect={handleSelect} onLoadDemo={handleLoadDemo} />
      <ReportHelp />

      {error ? (
        <p className="app__error" role="alert">
          {error}
        </p>
      ) : null}

      <p className="app__meta">
        Showing <strong>{source}</strong> · {result.tasks.length} tests ·{' '}
        {formatDuration(testTimeMs)} of test time
      </p>

      <Controls settings={settings} current={result.current} onChange={setSettings} />

      <CurrentCard
        current={result.current}
        workersPerShard={settings.workersPerShard}
        pricePerMinute={settings.pricePerMinute}
      />

      <section className="card" aria-labelledby="moves-heading">
        <h2 id="moves-heading">Your moves</h2>
        <ol className="moves-list">
          {merged ? (
            <MoveCard
              tag={chosenLabel}
              title={`Rebalance your ${result.current.shardCount} shards — your best move is free`}
              scenario={chosen}
              pricePerMinute={settings.pricePerMinute}
            />
          ) : (
            <>
              <MoveCard
                tag="Free"
                title={`Rebalance your ${result.current.shardCount} shards`}
                scenario={rebalance}
                pricePerMinute={settings.pricePerMinute}
              />
              <MoveCard
                tag={chosenLabel}
                title={`${chosen.config.shardCount} shards`}
                scenario={chosen}
                pricePerMinute={settings.pricePerMinute}
              />
            </>
          )}
        </ol>
      </section>

      <FindingsCard findings={result.findings} />

      <details className="card details">
        <summary>Show the full cost / time frontier</summary>
        <div className="details__body">
          <FrontierChart
            frontier={result.frontier}
            recommended={chosen.config}
            current={result.current}
            ratePerMin={settings.pricePerMinute}
          />
        </div>
      </details>
    </main>
  );
}
