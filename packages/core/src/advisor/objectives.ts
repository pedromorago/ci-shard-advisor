import type { Objective } from './types';

/**
 * The user-facing objective names (spec §5.4) mapped onto the core kinds —
 * `recommended` is the knee criterion, internally the `balanced` kind. Every
 * adapter (web, CLI, API) builds its objective through these helpers so the
 * rename and the money↔ms conversion live in exactly one place.
 */
export function objectiveFor(choice: 'recommended' | 'fastest'): Objective {
  return { kind: choice === 'recommended' ? 'balanced' : 'fastest' };
}

/** The cheapest configuration whose feedback stays within the given limit. */
export function maxFeedbackObjective(feedbackMs: number): Objective {
  return { kind: 'max-feedback', feedbackMs };
}

/**
 * The fastest configuration within a cost budget. With a price the amount is
 * money (converted at that rate); without one it is machine minutes.
 */
export function budgetObjective(amount: number, pricePerMinute?: number): Objective {
  const costMs = pricePerMinute ? (amount / pricePerMinute) * 60_000 : amount * 60_000;
  return { kind: 'budget', costMs };
}
