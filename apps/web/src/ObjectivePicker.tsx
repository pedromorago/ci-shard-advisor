import type { MeasuredCurrent } from '@ci-shard-advisor/core';
import type { ObjectiveKind, ObjectiveSetting } from './analysis';

interface ObjectivePickerProps {
  objective: ObjectiveSetting;
  /** The measured current situation — prefills the parameterized objectives. */
  current: MeasuredCurrent;
  pricePerMinute: number;
  onChange: (objective: ObjectiveSetting) => void;
}

/**
 * The "Optimize for" selector. It lives next to the move card it drives, after
 * the current situation — first you see where you are, then you pick the move.
 */
export function ObjectivePicker({ objective, current, pricePerMinute, onChange }: ObjectivePickerProps) {
  const num = (raw: string, min: number) => {
    const value = Number(raw);
    return Number.isFinite(value) ? Math.max(min, value) : min;
  };

  // Defaults anchored to your measured situation (spec §5.4): the max-wait
  // objective starts at your current wait ("same wait, cheaper") and the
  // budget one at your current cost ("same cost, faster").
  const currentWaitSec = Math.ceil(current.feedbackTimeMs / 1000);
  const currentBudget =
    pricePerMinute > 0
      ? Number(((current.costMs / 60_000) * pricePerMinute).toFixed(2))
      : Number((current.costMs / 60_000).toFixed(1));

  function select(kind: ObjectiveKind) {
    onChange(
      kind === 'max-wait'
        ? { kind, seconds: currentWaitSec }
        : kind === 'budget'
          ? { kind, euros: currentBudget }
          : { kind },
    );
  }

  return (
    <div className="controls__grid objective-picker">
      <label className="control">
        <span>Optimize for</span>
        <select value={objective.kind} onChange={(e) => select(e.target.value as ObjectiveKind)}>
          <option value="recommended">Recommended (best trade-off)</option>
          <option value="fastest">Fastest</option>
          <option value="max-wait">Cheapest within a wait limit</option>
          <option value="budget">Fastest within a budget</option>
        </select>
      </label>
      {objective.kind === 'max-wait' ? (
        <label className="control">
          <span>Wait limit (s)</span>
          <input
            type="number"
            min={1}
            step={5}
            value={objective.seconds}
            onChange={(e) => onChange({ kind: 'max-wait', seconds: num(e.target.value, 1) })}
          />
        </label>
      ) : null}
      {objective.kind === 'budget' ? (
        <label className="control">
          <span>{pricePerMinute > 0 ? 'Budget per run (€)' : 'Budget (machine min)'}</span>
          <input
            type="number"
            min={0}
            step={pricePerMinute > 0 ? 0.01 : 1}
            value={objective.euros}
            onChange={(e) => onChange({ kind: 'budget', euros: num(e.target.value, 0) })}
          />
        </label>
      ) : null}
    </div>
  );
}
