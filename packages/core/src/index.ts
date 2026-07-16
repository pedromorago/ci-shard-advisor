/**
 * Public surface of @ci-shard-advisor/core.
 *
 * The PUBLIC GATE below is the whole contract the adapters (web, CLI, API)
 * consume: `advise()` in, `toAdvisor*` / CI exporters out (spec §6). The
 * ENGINE PRIMITIVES section exposes the underlying building blocks for
 * library consumers who want the solver or a single reader without the
 * advisor on top — the adapters never import them.
 */

// ─── Public gate ────────────────────────────────────────────────────────────
export { advise } from './advisor/advise';
export type { AdviseOptions } from './advisor/advise';
export type {
  ReportFile,
  AnalyzeInput,
  CostModel,
  Objective,
  MeasuredCurrent,
  ShardPlan,
  Scenario,
  Findings,
  AdvisorResult,
  Runner,
} from './advisor/types';
export type { TaskStatus, AtomicTask } from './types/domain';
export type { ReportFormat } from './report/analyze';
export { ReportParseError } from './report/parser';

export {
  toAdvisorText,
  toAdvisorJson,
  toAdvisorObject,
  toAdvisorMarkdown,
  presentedMoves,
  objectiveLabel,
} from './exporters/advisor';
export { toGitHubActions, toBitbucketPipelines } from './exporters/ci';
export { unitOf, unitsOf, applyCommand } from './advisor/vocabulary';
export { objectiveFor, maxFeedbackObjective, budgetObjective } from './advisor/objectives';
export {
  formatDuration,
  formatSignedDuration,
  formatMoney,
  signedDuration,
  signedMoney,
} from './exporters/format';

// ─── Engine primitives (library consumers; not used by the adapters) ───────
export { lpt } from './scheduler/lpt';
export type { ScheduleResult } from './scheduler/lpt';
export { avgBound, pmaxBound, lowerBound } from './scheduler/bounds';
export { branchAndBound } from './scheduler/branch-and-bound';
export type { SolveResult, SolveOptions } from './scheduler/branch-and-bound';
export { simulateShard, simulateRun } from './scheduler/workers';
export type { SimulationResult, RunSimulation } from './scheduler/workers';
export { buildFrontier, evaluateConfig } from './recommender/frontier';
export type { ConfigPoint, FrontierOptions } from './recommender/frontier';
export { findElbow } from './recommender/elbow';
export { detectFormat, readReport } from './report/analyze';
export { parseReport } from './report/parser';
export type { PlaywrightReport } from './report/playwright-report';
export { normalize } from './report/normalizer';
export { parseCypressReport, normalizeCypress } from './report/cypress';
export type { CypressReport } from './report/cypress-report';
export { parseJUnitReport, normalizeJUnit } from './report/junit';
export type { JUnitReport, JUnitCase } from './report/junit';
export { parseMochawesomeReport, normalizeMochawesome } from './report/mochawesome';
export type { MochawesomeReport } from './report/mochawesome';
