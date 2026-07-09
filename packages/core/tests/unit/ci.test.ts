import { describe, expect, it } from 'vitest';
import { toGitHubActions, toBitbucketPipelines } from '../../src/exporters/ci';

const SPECS = [['checkout.spec.ts'], ['cart.spec.ts', 'search.spec.ts'], ['login.spec.ts']];

describe('toGitHubActions', () => {
  it('builds one job per shard, each running exactly its spec list', () => {
    const yaml = toGitHubActions(SPECS, 'playwright');
    expect(yaml).toContain('npx playwright test checkout.spec.ts --reporter=json > shard-1.json');
    expect(yaml).toContain('npx playwright test cart.spec.ts search.spec.ts --reporter=json > shard-2.json');
    expect(yaml).toContain('name: Shard 3/3 (optimal split)');
    // One report per shard, ready to feed back to the advisor.
    expect(yaml).toContain('name: shard-1');
    expect(yaml).toContain('npx playwright install --with-deps');
  });

  it('uses the Cypress command for Cypress reports', () => {
    const yaml = toGitHubActions([['a.cy.ts', 'b.cy.ts']], 'cypress');
    expect(yaml).toContain('npx cypress run --reporter mochawesome');
    expect(yaml).toContain('--spec "a.cy.ts,b.cy.ts"');
    expect(yaml).not.toContain('playwright');
  });

  it('rejects empty spec lists', () => {
    expect(() => toGitHubActions([], 'playwright')).toThrow(RangeError);
    expect(() => toGitHubActions([['a.spec.ts'], []], 'playwright')).toThrow(RangeError);
  });
});

describe('toBitbucketPipelines', () => {
  it('builds one parallel step per shard, each running exactly its spec list', () => {
    const yaml = toBitbucketPipelines(SPECS, 'playwright');
    expect(yaml).toContain('- parallel:');
    expect(yaml).toContain('npx playwright test checkout.spec.ts --reporter=json > shard-1.json');
    expect(yaml).toContain('npx playwright test login.spec.ts --reporter=json > shard-3.json');
    expect(yaml.match(/- step:/g)).toHaveLength(3); // one per shard, no merge step
  });

  it('rejects empty spec lists', () => {
    expect(() => toBitbucketPipelines([], 'cypress')).toThrow(RangeError);
  });
});
