import { advise, objectiveFor, maxFeedbackObjective, budgetObjective } from '@ci-shard-advisor/core';
import type { AdvisorResult, CostModel, MeasuredCurrent, Objective, ReportFile } from '@ci-shard-advisor/core';
import { DEMO_REPORTS } from './demo';

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
  /** Declared container count when a single merged report is uploaded. */
  currentShardCount: number;
  /** The chosen move. */
  objective: ObjectiveSetting;
}

export const DEFAULT_SETTINGS: AnalysisSettings = {
  startupOverheadSec: 45,
  pricePerMinute: 0.01,
  currentShardCount: 3,
  objective: { kind: 'recommended' },
};

export { DEMO_REPORTS };

/** Map the UI objective onto the core Objective (the conversions live in core). */
function toObjective(setting: ObjectiveSetting, pricePerMinute: number): Objective {
  switch (setting.kind) {
    case 'recommended':
    case 'fastest':
      return objectiveFor(setting.kind);
    case 'max-wait':
      return maxFeedbackObjective(setting.seconds * 1000);
    case 'budget':
      // With a price, the budget is euros; without one it is machine minutes.
      return budgetObjective(setting.euros, pricePerMinute > 0 ? pricePerMinute : undefined);
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

  // No workers option: Cypress runs a container's specs serially.
  return advise(input, cost, {
    objective: toObjective(settings.objective, settings.pricePerMinute),
    maxShards: 16,
  });
}

/**
 * Prefills for the parameterized objectives (spec §5.4): anchored to the
 * measured current situation, rounded UP so the prefilled limit always
 * contains the current value — "same wait, cheaper" / "same cost, faster"
 * must be feasible at the moment they are offered.
 */
export function prefillWaitSec(current: MeasuredCurrent): number {
  return Math.ceil(current.feedbackTimeMs / 1000);
}

export function prefillBudget(current: MeasuredCurrent, pricePerMinute: number): number {
  const minutes = current.costMs / 60_000;
  return pricePerMinute > 0
    ? Math.ceil(minutes * pricePerMinute * 100) / 100 // euros, whole cents
    : Math.ceil(minutes * 10) / 10; // machine minutes, one decimal
}
