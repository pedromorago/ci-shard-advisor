import type { MeasuredCurrent } from '@ci-shard-advisor/core';
import type { AnalysisSettings, ObjectiveKind, ObjectiveSetting } from './analysis';

interface ControlsProps {
  settings: AnalysisSettings;
  /** The measured current situation — prefills the parameterized objectives. */
  current: MeasuredCurrent;
  onChange: (settings: AnalysisSettings) => void;
}

/** The knobs that are not in the reports: setup, price, workers, objective. */
export function Controls({ settings, current, onChange }: ControlsProps) {
  const update = (patch: Partial<AnalysisSettings>) => onChange({ ...settings, ...patch });
  const num = (raw: string, min: number) => {
    const value = Number(raw);
    return Number.isFinite(value) ? Math.max(min, value) : min;
  };

  // Defaults anchored to your measured situation (spec §5.4): the max-wait
  // objective starts at your current wait ("same wait, cheaper") and the
  // budget one at your current cost ("same cost, faster").
  const currentWaitSec = Math.ceil(current.feedbackTimeMs / 1000);
  const currentBudget =
    settings.pricePerMinute > 0
      ? Number(((current.costMs / 60_000) * settings.pricePerMinute).toFixed(2))
      : Number((current.costMs / 60_000).toFixed(1));

  function selectObjective(kind: ObjectiveKind) {
    const objective: ObjectiveSetting =
      kind === 'max-wait'
        ? { kind, seconds: currentWaitSec }
        : kind === 'budget'
          ? { kind, euros: currentBudget }
          : { kind };
    update({ objective });
  }

  return (
    <section className="controls card" aria-labelledby="controls-heading">
      <h2 id="controls-heading">Your CI setup</h2>
      <p className="controls__hint">These describe how you run CI — they are not in the reports.</p>
      <div className="controls__grid">
        <label className="control">
          <span>Startup overhead (s)</span>
          <input
            type="number"
            min={0}
            step={5}
            value={settings.startupOverheadSec}
            onChange={(e) => update({ startupOverheadSec: num(e.target.value, 0) })}
          />
        </label>
        <label className="control">
          <span>Cost per minute (€)</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={settings.pricePerMinute}
            onChange={(e) => update({ pricePerMinute: num(e.target.value, 0) })}
          />
        </label>
        <label className="control">
          <span>Workers per shard</span>
          <input
            type="number"
            min={1}
            step={1}
            value={settings.workersPerShard}
            onChange={(e) => update({ workersPerShard: Math.round(num(e.target.value, 1)) })}
          />
        </label>
        <label className="control">
          <span>Shards (merged report)</span>
          <input
            type="number"
            min={1}
            step={1}
            value={settings.currentShardCount}
            onChange={(e) => update({ currentShardCount: Math.round(num(e.target.value, 1)) })}
          />
        </label>
        <label className="control">
          <span>Optimize for</span>
          <select
            value={settings.objective.kind}
            onChange={(e) => selectObjective(e.target.value as ObjectiveKind)}
          >
            <option value="recommended">Recommended (best trade-off)</option>
            <option value="fastest">Fastest</option>
            <option value="max-wait">Cheapest within a wait limit</option>
            <option value="budget">Fastest within a budget</option>
          </select>
        </label>
        {settings.objective.kind === 'max-wait' ? (
          <label className="control">
            <span>Wait limit (s)</span>
            <input
              type="number"
              min={1}
              step={5}
              value={settings.objective.seconds}
              onChange={(e) => update({ objective: { kind: 'max-wait', seconds: num(e.target.value, 1) } })}
            />
          </label>
        ) : null}
        {settings.objective.kind === 'budget' ? (
          <label className="control">
            <span>{settings.pricePerMinute > 0 ? 'Budget per run (€)' : 'Budget (machine min)'}</span>
            <input
              type="number"
              min={0}
              step={settings.pricePerMinute > 0 ? 0.01 : 1}
              value={settings.objective.euros}
              onChange={(e) => update({ objective: { kind: 'budget', euros: num(e.target.value, 0) } })}
            />
          </label>
        ) : null}
      </div>
    </section>
  );
}
