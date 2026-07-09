import type { ConfigPoint } from '../recommender/frontier';
import type { AtomicTask } from '../types/domain';

/** A single report file as it arrives (one per shard, or one merged). */
export interface ReportFile {
  /** For messages, e.g. "shard-3.json". */
  name: string;
  /** Raw JSON string / XML, or an already-parsed object. */
  content: string | unknown;
}

/**
 * How the reports arrive:
 * - `per-shard` (preferred): one report per shard → the current setup is
 *   *measured* (real per-shard times).
 * - `merged` (degraded): one report + a declared shard count → the current
 *   setup is *modeled* (split by test count).
 */
export type AnalyzeInput =
  | { kind: 'per-shard'; reports: ReportFile[] }
  | { kind: 'merged'; report: ReportFile; currentShardCount?: number };

/** The cost model: startup overhead per shard, and an optional machine price. */
export interface CostModel {
  /** Per-shard startup overhead in ms (boot, install, browsers). */
  startupOverheadMs: number;
  /** Price per machine-minute; when set, outputs can show money. */
  pricePerMinute?: number;
  /** Currency symbol for money output (default '€'). */
  currency?: string;
}

/** What to optimize the "objective" scenario for. */
export type Objective =
  | { kind: 'balanced' }
  | { kind: 'fastest' }
  | { kind: 'cheapest' }
  | { kind: 'max-feedback'; feedbackMs: number }
  | { kind: 'budget'; costMs: number }
  | { kind: 'weight'; costPerFeedbackMinute: number };

/** The team's current setup — measured from per-shard reports, or modeled. */
export interface MeasuredCurrent {
  shardCount: number;
  /** Real (or modeled) wall time per shard. */
  shardTimesMs: number[];
  feedbackTimeMs: number;
  costMs: number;
  /** max(shardTime) - min(shardTime): time paid for idle machines. */
  imbalanceMs: number;
  /** false when modeled from a merged report. */
  measured: boolean;
}

/** How to apply an optimal split in the real runner (closes the model↔reality gap). */
export interface ShardPlan {
  /** Task ids per shard (the optimal split). */
  shards: string[][];
  /** Spec files per shard — the applicable part: each CI job runs its list. */
  specs: string[][];
}

/** One recommended move, anchored to the current situation. */
export interface Scenario {
  id: 'rebalance' | 'same-feedback-cheaper' | 'same-cost-faster' | 'objective';
  /** The frontier point (money derived when presented). */
  config: ConfigPoint;
  /** Deltas versus the current setup. */
  vsCurrent?: { feedbackDeltaMs: number; costDeltaMs: number };
  /** One sentence: why this point. */
  reason: string;
  /** How to apply it (5.3). */
  plan?: ShardPlan;
  /** Set when this scenario coincides with another. */
  sameAs?: Scenario['id'];
  /** Set when the scenario has no answer (e.g. nothing cheaper meets the wait). */
  unavailable?: boolean;
  /** Only on id 'objective': the objective that produced it (for labelling). */
  objective?: Objective;
}

/** The advisor's voice: written findings + the flaky breakdown. */
export interface Findings {
  /** Sentences from spec 5.5, already worded in the core. */
  warnings: string[];
  flaky: { id: string; title: string; retries: number; wastedMs: number }[];
}

/** The runner the reports came from; decides the plan's apply command. */
export type Runner = 'playwright' | 'cypress';

/** The full advisor answer. */
export interface AdvisorResult {
  current: MeasuredCurrent;
  scenarios: Scenario[];
  frontier: ConfigPoint[];
  findings: Findings;
  tasks: AtomicTask[];
  runner: Runner;
}
