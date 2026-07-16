import type { Runner } from './types';

/**
 * Domain vocabulary shared by every layer that words a sentence or a command.
 * It lives in the advisor (domain), not in the exporters: presentation depends
 * on the domain, never the other way around — spec §5.5 puts the advisor's
 * voice in the core precisely so all adapters say the same thing.
 */

/** The machine word each runner's users say: Cypress containers, Playwright shards. */
export function unitOf(runner: Runner): string {
  return runner === 'cypress' ? 'container' : 'shard';
}

/** The machine word with a count: "1 container", "3 shards". */
export function unitsOf(count: number, runner: Runner): string {
  return `${count} ${unitOf(runner)}${count === 1 ? '' : 's'}`;
}

/** The real, runnable command for one shard's spec list (spec §5.3). */
export function applyCommand(runner: Runner, specs: string[]): string {
  return runner === 'cypress'
    ? `npx cypress run --spec "${specs.join(',')}"`
    : `npx playwright test ${specs.join(' ')}`;
}
