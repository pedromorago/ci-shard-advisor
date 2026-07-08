import { describe, expect, it } from 'vitest';
import demoReport from '../fixtures/demo-report.json';
import { analyze } from '../../src/report/analyze';
import { toText } from '../../src/exporters/text';

describe('toText', () => {
  it('renders a deterministic CLI report for the demo suite', () => {
    const analysis = analyze(demoReport, {
      maxShards: 6,
      startupOverheadMs: 30000,
      currentShardCount: 6,
    });
    expect(toText(analysis)).toMatchInlineSnapshot(`
      "CI Shard Advisor
      ================

      Suite: 12 tests, 4m 4s total

      Blocks:
        regression    7 tests  3m 21s
        sanity        5 tests  43.3s

      Recommended: 3 shards x 1 worker
        Feedback time: 1m 53s
        Billed cost:   5m 34s
        optimal split

      Current: 6 shards x 1 worker
        Feedback time: 1m 56s
        Billed cost:   7m 4s
      Change vs current: feedback -3.0s, cost -1m 30s

      Frontier:
        shards  feedback    cost
        1       4m 34s      4m 34s
        2       2m 32s      5m 4s
        3       1m 53s      5m 34s
        4       1m 32s      6m 4s
        5       1m 30s      6m 34s
        6       1m 30s      7m 4s"
    `);
  });
});
