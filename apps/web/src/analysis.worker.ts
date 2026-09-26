import type { ReportFile } from '@ci-shard-advisor/core';
import { adviseFrom } from './analysis';
import type { AnalysisSettings } from './analysis';

export interface AnalysisRequest {
  id: number;
  reports: ReportFile[];
  settings: AnalysisSettings;
}

export type AnalysisReply =
  | { id: number; result: ReturnType<typeof adviseFrom> }
  | { id: number; error: string };

// The analysis, off the main thread (see useAnalysis). The reports arrive by
// postMessage and never leave the page.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<AnalysisRequest>) => void) | null;
  postMessage(message: AnalysisReply): void;
};

scope.onmessage = ({ data: { id, reports, settings } }) => {
  try {
    scope.postMessage({ id, result: adviseFrom(reports, settings) });
  } catch (cause) {
    scope.postMessage({ id, error: cause instanceof Error ? cause.message : String(cause) });
  }
};
