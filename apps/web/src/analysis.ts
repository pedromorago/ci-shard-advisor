import { advise } from '@ci-shard-advisor/core';
import type { AdvisorResult, CostModel, Objective, ReportFile } from '@ci-shard-advisor/core';
import { DEMO_PLAYWRIGHT, DEMO_CYPRESS } from './demo';

/**
 * The objective the user picks in "Optimize for" (spec §5.4):
 * - recommended: the knee of the frontier (the core's 'balanced').
 * - fastest: minimum wait, whatever it costs.
 * - max-wait: cheapest within a wait limit — prefilled with the current wait.
 * - budget: fastest within a cost budget — prefilled with the current cost.
 */
export type ObjectiveSetting =
  | { kind: 'recommended' }
  | { kind: 'fastest' }
  | { kind: 'max-wait'; seconds: number }
  | { kind: 'budget'; euros: number };

export type ObjectiveKind = ObjectiveSetting['kind'];

/** The knobs the user controls — none of these come from the reports. */
export interface AnalysisSettings {
  /** Per-shard CI startup overhead, in seconds. */
  startupOverheadSec: number;
  /** Machine price per minute; 0 means "show machine time, not money". */
  pricePerMinute: number;
  /** Workers running in parallel inside each shard. */
  workersPerShard: number;
  /** Declared shard count when a single merged report is uploaded. */
  currentShardCount: number;
  /** The chosen move. */
  objective: ObjectiveSetting;
}

export const DEFAULT_SETTINGS: AnalysisSettings = {
  startupOverheadSec: 45,
  pricePerMinute: 0.01,
  workersPerShard: 1,
  currentShardCount: 4,
  objective: { kind: 'recommended' },
};

export { DEMO_PLAYWRIGHT, DEMO_CYPRESS };

/** Map the UI objective onto the core Objective. */
function toObjective(setting: ObjectiveSetting, pricePerMinute: number): Objective {
  switch (setting.kind) {
    case 'recommended':
      return { kind: 'balanced' };
    case 'fastest':
      return { kind: 'fastest' };
    case 'max-wait':
      return { kind: 'max-feedback', feedbackMs: setting.seconds * 1000 };
    case 'budget':
      // With a price, the budget is euros; without one it is machine minutes.
      return {
        kind: 'budget',
        costMs: pricePerMinute > 0 ? (setting.euros / pricePerMinute) * 60_000 : setting.euros * 60_000,
      };
  }
}

/** Run the advisor over the uploaded reports (per-shard) or a single one (merged). */
export function adviseFrom(reports: ReportFile[], settings: AnalysisSettings): AdvisorResult {
  const cost: CostModel = { startupOverheadMs: settings.startupOverheadSec * 1000, currency: '€' };
  if (settings.pricePerMinute > 0) cost.pricePerMinute = settings.pricePerMinute;

  const input =
    reports.length >= 2
      ? { kind: 'per-shard' as const, reports }
      : { kind: 'merged' as const, report: reports[0], currentShardCount: settings.currentShardCount };

  return advise(input, cost, {
    objective: toObjective(settings.objective, settings.pricePerMinute),
    workersPerShard: settings.workersPerShard,
    maxShards: 16,
  });
}

/** Format billed ms as money at the given rate, or null when there is no price. */
export function formatMoney(costMs: number, pricePerMinute: number): string | null {
  if (!pricePerMinute) return null;
  return `€${((costMs / 60_000) * pricePerMinute).toFixed(2)}`;
}
