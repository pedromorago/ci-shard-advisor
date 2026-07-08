import { useState } from 'react';
import { toGitHubActions, toBitbucketPipelines } from '@ci-shard-advisor/core';

type Platform = 'github' | 'bitbucket';

interface CiConfigProps {
  /** The recommended shard count to wire into the CI config. */
  shardCount: number;
}

/**
 * Turns the recommendation into ready-to-paste CI config that shards a
 * Playwright run across N jobs and merges the blob reports back into the JSON
 * this tool reads — closing the loop to real cloud execution.
 */
export function CiConfig({ shardCount }: CiConfigProps) {
  const [platform, setPlatform] = useState<Platform>('github');
  const [copied, setCopied] = useState(false);

  const yaml = platform === 'github' ? toGitHubActions(shardCount) : toBitbucketPipelines(shardCount);
  const fileName = platform === 'github' ? '.github/workflows/tests.yml' : 'bitbucket-pipelines.yml';

  const copy = () => {
    void navigator.clipboard?.writeText(yaml);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="card" aria-labelledby="ci-heading">
      <h2 id="ci-heading">Set it up in CI</h2>
      <p className="ci__hint">
        Shard your pipeline into {shardCount} parallel jobs and merge the reports —
        paste this into <code>{fileName}</code>.
      </p>

      <div className="modes" role="group" aria-label="CI platform">
        <button
          type="button"
          className={platform === 'github' ? 'mode mode--active' : 'mode'}
          aria-pressed={platform === 'github'}
          onClick={() => setPlatform('github')}
        >
          GitHub Actions
        </button>
        <button
          type="button"
          className={platform === 'bitbucket' ? 'mode mode--active' : 'mode'}
          aria-pressed={platform === 'bitbucket'}
          onClick={() => setPlatform('bitbucket')}
        >
          Bitbucket
        </button>
        <button type="button" className="mode ci__copy" onClick={copy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <pre className="ci__code" aria-label={`${platform} config`}>
        <code>{yaml}</code>
      </pre>
    </section>
  );
}
