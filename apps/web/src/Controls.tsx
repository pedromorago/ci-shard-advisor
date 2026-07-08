import type { AnalysisSettings } from './analysis';

interface ControlsProps {
  settings: AnalysisSettings;
  onChange: (settings: AnalysisSettings) => void;
}

/**
 * The knobs that are NOT in the report and must come from the user: CI startup
 * overhead, workers per shard, and the current shard count. Changing any of
 * them re-runs the analysis.
 */
export function Controls({ settings, onChange }: ControlsProps) {
  const update = (patch: Partial<AnalysisSettings>) => onChange({ ...settings, ...patch });

  // Clamp to a sane, positive value; ignore empty/NaN input.
  const num = (raw: string, min: number) => {
    const value = Number(raw);
    return Number.isFinite(value) ? Math.max(min, value) : min;
  };

  return (
    <section className="controls card" aria-labelledby="controls-heading">
      <h2 id="controls-heading">Settings</h2>
      <p className="controls__hint">
        These describe your CI setup — they are not in the report.
      </p>
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
          <span>Your current shards</span>
          <input
            type="number"
            min={1}
            step={1}
            value={settings.currentShardCount}
            onChange={(e) => update({ currentShardCount: Math.round(num(e.target.value, 1)) })}
          />
        </label>
      </div>
    </section>
  );
}
