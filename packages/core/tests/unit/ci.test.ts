import { describe, expect, it } from 'vitest';
import { toGitHubActions, toBitbucketPipelines } from '../../src/exporters/ci';

describe('toGitHubActions', () => {
  it('builds a matrix of N shards feeding a merge job', () => {
    const yaml = toGitHubActions(4);
    expect(yaml).toContain('shard: [1, 2, 3, 4]');
    expect(yaml).toContain('--shard=${{ matrix.shard }}/4');
    expect(yaml).toContain('npx playwright merge-reports --reporter json');
    expect(yaml).toContain('needs: [test]');
  });

  it('rejects an invalid shard count', () => {
    expect(() => toGitHubActions(0)).toThrow(RangeError);
    expect(() => toGitHubActions(2.5)).toThrow(RangeError);
  });
});

describe('toBitbucketPipelines', () => {
  it('builds N parallel steps plus a merge step', () => {
    const yaml = toBitbucketPipelines(3);
    expect(yaml).toContain('- parallel:');
    expect(yaml).toContain('npx playwright test --shard=1/3 --reporter=blob');
    expect(yaml).toContain('npx playwright test --shard=3/3 --reporter=blob');
    expect(yaml).toContain('merge-reports --reporter json');
    // One shard step per shard.
    expect(yaml.match(/- step:/g)).toHaveLength(3 + 1); // 3 shards + merge
  });

  it('rejects an invalid shard count', () => {
    expect(() => toBitbucketPipelines(-1)).toThrow(RangeError);
  });
});
