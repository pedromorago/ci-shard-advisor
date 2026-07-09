import type { AtomicTask } from '../types/domain';
import { detectFormat, readReport } from '../report/analyze';
import type { ReportFormat } from '../report/analyze';
import { ReportParseError } from '../report/parser';
import type { AnalyzeInput } from './types';

export interface ReadReports {
  /** Tasks for each shard (one entry per shard in per-shard mode). */
  perShardTasks: AtomicTask[][];
  /** All tasks across shards, the material for re-planning. */
  allTasks: AtomicTask[];
  /** The detected report format (all files share it). */
  format: ReportFormat;
}

/**
 * Read the input reports into tasks. In per-shard mode every file is one shard
 * and all files must share a format (mixed → clear error). In merged mode there
 * is a single report.
 */
export function readReports(input: AnalyzeInput): ReadReports {
  if (input.kind === 'merged') {
    const format = detectFormat(input.report.content);
    const tasks = readReport(input.report.content, format);
    return { perShardTasks: [tasks], allTasks: tasks, format };
  }

  if (input.reports.length === 0) {
    throw new ReportParseError('at least one report is required');
  }

  let format: ReportFormat | undefined;
  const perShardTasks = input.reports.map((file) => {
    const detected = detectFormat(file.content);
    if (format !== undefined && detected !== format) {
      throw new ReportParseError(
        `mixed report formats: '${format}' and '${detected}' (${file.name})`,
      );
    }
    format = detected;
    return readReport(file.content, detected);
  });

  return { perShardTasks, allTasks: perShardTasks.flat(), format: format! };
}
