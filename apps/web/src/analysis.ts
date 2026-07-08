import { advise } from '@ci-shard-advisor/core';
import type { AdvisorResult, CostModel, Objective, ReportFile } from '@ci-shard-advisor/core';
import { DEMO_REPORTS } from './demo';

export type ObjectiveKind = 'balanced' | 'fastest' | 'cheapest';

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
  /** The "by objective" move. */
  objective: ObjectiveKind;
}

export const DEFAULT_SETTINGS: AnalysisSettings = {
  startupOverheadSec: 45,
  pricePerMinute: 0.01,
  workersPerShard: 1,
  currentShardCount: 4,
  objective: 'balanced',
};

export { DEMO_REPORTS };

/** Run the advisor over the uploaded reports (per-shard) or a single one (merged). */
export function adviseFrom(reports: ReportFile[], settings: AnalysisSettings): AdvisorResult {
  const cost: CostModel = { startupOverheadMs: settings.startupOverheadSec * 1000, currency: '€' };
  if (settings.pricePerMinute > 0) cost.pricePerMinute = settings.pricePerMinute;

  const input =
    reports.length >= 2
      ? { kind: 'per-shard' as const, reports }
      : { kind: 'merged' as const, report: reports[0], currentShardCount: settings.currentShardCount };

  return advise(input, cost, {
    objective: { kind: settings.objective } as Objective,
    workersPerShard: settings.workersPerShard,
    maxShards: 16,
  });
}

/** Format billed ms as money at the given rate, or null when there is no price. */
export function formatMoney(costMs: number, pricePerMinute: number): string | null {
  if (!pricePerMinute) return null;
  return `€${((costMs / 60_000) * pricePerMinute).toFixed(2)}`;
}
