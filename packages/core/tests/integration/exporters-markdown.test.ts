import { describe, expect, it } from 'vitest';
import demoReport from '../fixtures/demo-report.json';
import { analyze } from '../../src/report/analyze';
import { toMarkdown } from '../../src/exporters/markdown';

describe('toMarkdown', () => {
  const analysis = analyze(demoReport, {
    maxShards: 6,
    startupOverheadMs: 30000,
    currentShardCount: 6,
  });

  it('emphasizes the recommended row and renders valid tables', () => {
    const md = toMarkdown(analysis);
    expect(md.startsWith('## CI Shard Advisor')).toBe(true);
    expect(md).toContain('| Shards | Feedback | Cost |');
    // The recommended shard count row is bolded.
    expect(md).toContain(`| **${analysis.recommendation.recommended.shardCount}** |`);
  });

  it('renders a deterministic Markdown report for the demo suite', () => {
    expect(toMarkdown(analysis)).toMatchInlineSnapshot(`
      "## CI Shard Advisor

      **12 tests · 4m 4s total**

      ### Recommendation

      **3 shards × 1 worker** — 1m 53s feedback, 5m 34s cost (optimal split).

      Compared to the current **6 shards**: feedback +22.8s, cost -1m 30s.

      ### Blocks

      | Block | Tests | Duration |
      | --- | ---: | ---: |
      | regression | 7 | 3m 21s |
      | sanity | 5 | 43.3s |

      ### Frontier

      | Shards | Feedback | Cost |
      | ---: | ---: | ---: |
      | 1 | 4m 34s | 4m 34s |
      | 2 | 2m 32s | 5m 4s |
      | **3** | **1m 53s** | **5m 34s** |
      | 4 | 1m 32s | 6m 4s |
      | 5 | 1m 30s | 6m 34s |
      | 6 | 1m 30s | 7m 4s |"
    `);
  });
});
