import type { AnalysisResult } from '../report/analyze';
import { formatDuration, formatSignedDuration, summarize } from './summary';
import type { ConfigPoint } from '../recommender/frontier';

function workers(point: ConfigPoint): string {
  return `${point.workersPerShard} worker${point.workersPerShard === 1 ? '' : 's'}`;
}

/**
 * Render the analysis as a plain-text report for a terminal. Every value is
 * formatted deterministically so the output is snapshot-stable.
 */
export function toText(analysis: AnalysisResult): string {
  const summary = summarize(analysis);
  const lines: string[] = [];

  lines.push('CI Shard Advisor');
  lines.push('================');
  lines.push('');
  lines.push(`Suite: ${summary.totalTests} tests, ${formatDuration(summary.totalDurationMs)} total`);

  lines.push('');
  lines.push('Blocks:');
  const blockWidth = summary.blocks.length
    ? Math.max(...summary.blocks.map((b) => b.block.length))
    : 0;
  for (const block of summary.blocks) {
    lines.push(
      `  ${block.block.padEnd(blockWidth)}  ${String(block.tests).padStart(3)} tests  ${formatDuration(block.durationMs)}`,
    );
  }

  const recommended = summary.recommended;
  lines.push('');
  lines.push(`Recommended: ${recommended.shardCount} shards x ${workers(recommended)}`);
  lines.push(`  Feedback time: ${formatDuration(recommended.feedbackTimeMs)}`);
  lines.push(`  Billed cost:   ${formatDuration(recommended.costMs)}`);
  lines.push(`  ${recommended.optimal ? 'optimal split' : 'heuristic split (not certified optimal)'}`);

  if (summary.current && summary.savings) {
    const current = summary.current;
    lines.push('');
    lines.push(`Current: ${current.shardCount} shards x ${workers(current)}`);
    lines.push(`  Feedback time: ${formatDuration(current.feedbackTimeMs)}`);
    lines.push(`  Billed cost:   ${formatDuration(current.costMs)}`);
    // Deltas of recommended relative to current; negative means better.
    lines.push(
      `Change vs current: feedback ${formatSignedDuration(-summary.savings.timeSavedMs)}, cost ${formatSignedDuration(summary.savings.costDeltaMs)}`,
    );
  }

  lines.push('');
  lines.push('Frontier:');
  lines.push(`  ${'shards'.padEnd(8)}${'feedback'.padEnd(12)}cost`);
  for (const point of summary.frontier) {
    lines.push(
      `  ${String(point.shardCount).padEnd(8)}${formatDuration(point.feedbackTimeMs).padEnd(12)}${formatDuration(point.costMs)}`,
    );
  }

  return lines.join('\n');
}
