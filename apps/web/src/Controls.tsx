import type { AnalysisSettings } from './analysis';

interface ControlsProps {
  settings: AnalysisSettings;
  /** With one merged report the shard count must be declared; with one report
   * per shard it is deduced from the file count, so the field disappears. */
  merged: boolean;
  onChange: (settings: AnalysisSettings) => void;
}

/** The knobs that are not in the reports: setup, price, workers, shard count. */
export function Controls({ settings, merged, onChange }: ControlsProps) {
  const update = (patch: Partial<AnalysisSettings>) => onChange({ ...settings, ...patch });
  const num = (raw: string, min: number) => {
    const value = Number(raw);
    return Number.isFinite(value) ? Math.max(min, value) : min;
  };

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
        {merged ? (
          <label className="control">
            <span>Shards you run today</span>
            <input
              type="number"
              min={1}
              step={1}
              value={settings.currentShardCount}
              onChange={(e) => update({ currentShardCount: Math.round(num(e.target.value, 1)) })}
            />
          </label>
        ) : null}
      </div>
    </section>
  );
}
