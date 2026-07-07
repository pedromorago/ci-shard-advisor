import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatSignedDuration,
  summarize,
} from '../../src/exporters/summary';
import { toJson } from '../../src/exporters/json';
import { recommend } from '../../src/recommender/recommend';
import type { AtomicTask } from '../../src/types/domain';
import type { AnalysisResult } from '../../src/report/analyze';

function task(block: string, durationMs: number, id: string): AtomicTask {
  return { id, title: id, file: `${id}.spec.ts`, durationMs, status: 'passed', retries: 0, block };
}

function analysisOf(tasks: AtomicTask[]): AnalysisResult {
  const durations = tasks.map((t) => t.durationMs);
  return { tasks, recommendation: recommend(durations, { maxShards: 4, startupOverheadMs: 1000 }) };
}

describe('formatDuration', () => {
  it('renders sub-minute durations as seconds with one decimal', () => {
    expect(formatDuration(0)).toBe('0.0s');
    expect(formatDuration(5100)).toBe('5.1s');
    expect(formatDuration(59900)).toBe('59.9s');
  });

  it('renders longer durations as minutes and seconds', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(90000)).toBe('1m 30s');
    expect(formatDuration(244400)).toBe('4m 4s');
  });

  it('formatSignedDuration keeps an explicit sign', () => {
    expect(formatSignedDuration(5000)).toBe('+5.0s');
    expect(formatSignedDuration(-60000)).toBe('-1m 0s');
  });
});

describe('summarize', () => {
  it('aggregates tests and durations per block, heaviest first', () => {
    const summary = summarize(
      analysisOf([
        task('sanity', 1000, 'a'),
        task('regression', 5000, 'b'),
        task('regression', 3000, 'c'),
      ]),
    );
    expect(summary.totalTests).toBe(3);
    expect(summary.totalDurationMs).toBe(9000);
    expect(summary.blocks).toEqual([
      { block: 'regression', tests: 2, durationMs: 8000 },
      { block: 'sanity', tests: 1, durationMs: 1000 },
    ]);
  });
});

describe('toJson', () => {
  it('produces valid, stable JSON carrying the recommendation', () => {
    const analysis = analysisOf([task('sanity', 1000, 'a'), task('regression', 5000, 'b')]);
    const json = toJson(analysis);
    // Deterministic: same input, byte-identical output.
    expect(toJson(analysis)).toBe(json);

    const parsed = JSON.parse(json);
    expect(parsed.totalTests).toBe(2);
    expect(parsed.recommended.shardCount).toBe(analysis.recommendation.recommended.shardCount);
    expect(Array.isArray(parsed.frontier)).toBe(true);
  });
});
