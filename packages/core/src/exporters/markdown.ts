import type { AnalysisResult } from '../report/analyze';
import { formatDuration, formatSignedDuration, summarize } from './summary';
import type { ConfigPoint } from '../recommender/frontier';

function workers(point: ConfigPoint): string {
  return `${point.workersPerShard} worker${point.workersPerShard === 1 ? '' : 's'}`;
}

/**
 * Render the analysis as Markdown, suitable for a PR comment or a report file.
 * The recommended row of the frontier table is emphasized. Deterministic, so it
 * is snapshot-stable.
 */
export function toMarkdown(analysis: AnalysisResult): string {
  const summary = summarize(analysis);
  const md: string[] = [];
  const recommended = summary.recommended;

  md.push('## CI Shard Advisor');
  md.push('');
  md.push(`**${summary.totalTests} tests · ${formatDuration(summary.totalDurationMs)} total**`);
  md.push('');

  md.push('### Recommendation');
  md.push('');
  const split = recommended.optimal ? 'optimal split' : 'heuristic split';
  md.push(
    `**${recommended.shardCount} shards × ${workers(recommended)}** — ${formatDuration(recommended.feedbackTimeMs)} feedback, ${formatDuration(recommended.costMs)} cost (${split}).`,
  );
  if (summary.current && summary.savings) {
    md.push('');
    md.push(
      `Compared to the current **${summary.current.shardCount} shards**: feedback ${formatSignedDuration(-summary.savings.timeSavedMs)}, cost ${formatSignedDuration(summary.savings.costDeltaMs)}.`,
    );
  }
  md.push('');

  md.push('### Blocks');
  md.push('');
  md.push('| Block | Tests | Duration |');
  md.push('| --- | ---: | ---: |');
  for (const block of summary.blocks) {
    md.push(`| ${block.block} | ${block.tests} | ${formatDuration(block.durationMs)} |`);
  }
  md.push('');

  md.push('### Frontier');
  md.push('');
  md.push('| Shards | Feedback | Cost |');
  md.push('| ---: | ---: | ---: |');
  for (const point of summary.frontier) {
    const emphasize = point.shardCount === recommended.shardCount;
    const cell = (value: string): string => (emphasize ? `**${value}**` : value);
    md.push(
      `| ${cell(String(point.shardCount))} | ${cell(formatDuration(point.feedbackTimeMs))} | ${cell(formatDuration(point.costMs))} |`,
    );
  }

  return md.join('\n');
}
