import { useMemo, useState } from 'react';
import { formatDuration, objectiveLabel, presentedMoves, unitsOf } from '@ci-shard-advisor/core';
import type { ReportFile } from '@ci-shard-advisor/core';
import { adviseFrom, DEFAULT_SETTINGS, DEMO_REPORTS, prefillBudget, prefillWaitSec } from './analysis';
import type { AnalysisSettings } from './analysis';
import { ReportInput } from './ReportInput';
import { ReportHelp } from './ReportHelp';
import { Controls } from './Controls';
import { ObjectivePicker } from './ObjectivePicker';
import { CurrentCard } from './CurrentCard';
import { MoveCard } from './MoveCard';
import { FindingsCard } from './FindingsCard';
import { FrontierChart } from './FrontierChart';

export function App() {
  const [reports, setReports] = useState<ReportFile[]>(DEMO_REPORTS);
  const [source, setSource] = useState('demo (3 containers)');
  const [settings, setSettings] = useState<AnalysisSettings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(() => adviseFrom(reports, settings), [reports, settings]);

  // Keep the parameterized prefills anchored to the CURRENT measured situation
  // (spec §5.4): when new reports or a new price move the anchor, re-seed the
  // limit. Editing the limit itself never moves the anchor, so typing is safe.
  // Adjusted during render (the store-previous-value idiom) instead of in an
  // effect: React re-renders immediately, with no committed stale frame.
  const anchoredWaitSec = prefillWaitSec(result.current);
  const anchoredBudget = prefillBudget(result.current, settings.pricePerMinute);
  const [prevAnchor, setPrevAnchor] = useState({ waitSec: anchoredWaitSec, budget: anchoredBudget });
  if (prevAnchor.waitSec !== anchoredWaitSec || prevAnchor.budget !== anchoredBudget) {
    setPrevAnchor({ waitSec: anchoredWaitSec, budget: anchoredBudget });
    if (settings.objective.kind === 'max-wait' && settings.objective.seconds !== anchoredWaitSec) {
      setSettings({ ...settings, objective: { kind: 'max-wait', seconds: anchoredWaitSec } });
    } else if (settings.objective.kind === 'budget' && settings.objective.euros !== anchoredBudget) {
      setSettings({ ...settings, objective: { kind: 'budget', euros: anchoredBudget } });
    }
  }
  const testTimeMs = useMemo(
    () => result.tasks.reduce((sum, task) => sum + task.durationMs, 0),
    [result],
  );
  // The presentation decision (spec §5.2) is the core's, shared with the CLI:
  // the free rebalance + the chosen move, merged into one card if they coincide.
  const { rebalance, chosen, merged } = presentedMoves(result.scenarios);
  const chosenLabel = objectiveLabel(chosen);

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
    setSource('demo (3 containers)');
    setError(null);
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>CI Shard Advisor</h1>
        <p className="app__tagline">
          Parallelize Cypress with your head: you are here — these are your moves
          and what each one costs or saves. No Cypress Cloud needed.
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

      <Controls settings={settings} merged={reports.length < 2} onChange={setSettings} />

      <CurrentCard current={result.current} pricePerMinute={settings.pricePerMinute} runner={result.runner} />

      <section className="card" aria-labelledby="moves-heading">
        <h2 id="moves-heading">Your moves</h2>
        <ObjectivePicker
          objective={settings.objective}
          current={result.current}
          pricePerMinute={settings.pricePerMinute}
          onChange={(objective) => setSettings({ ...settings, objective })}
        />
        <ol className="moves-list">
          {merged ? (
            <MoveCard
              tag={chosenLabel}
              title={`Rebalance your ${unitsOf(result.current.shardCount, result.runner)} — your best move is free`}
              scenario={chosen}
              pricePerMinute={settings.pricePerMinute}
              runner={result.runner}
            />
          ) : (
            <>
              <MoveCard
                tag="Free"
                title={`Rebalance your ${unitsOf(result.current.shardCount, result.runner)}`}
                scenario={rebalance}
                pricePerMinute={settings.pricePerMinute}
                runner={result.runner}
              />
              <MoveCard
                tag={chosenLabel}
                title={unitsOf(chosen.config.shardCount, result.runner)}
                scenario={chosen}
                pricePerMinute={settings.pricePerMinute}
                runner={result.runner}
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
