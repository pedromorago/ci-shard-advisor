import { render, screen, within } from '@testing-library/react';
import { FrontierChart } from './FrontierChart';
import type { ConfigPoint } from '@ci-shard-advisor/core';

function point(shardCount: number, feedbackTimeMs: number, costMs: number): ConfigPoint {
  return { shardCount, workersPerShard: 1, runTimeMs: feedbackTimeMs, feedbackTimeMs, costMs, optimal: true };
}

const frontier = [
  point(1, 240000, 240000),
  point(2, 130000, 280000),
  point(3, 100000, 320000),
  point(4, 95000, 360000),
];

describe('FrontierChart', () => {
  it('renders an accessible chart describing the recommendation', () => {
    render(<FrontierChart frontier={frontier} recommended={frontier[2]} current={frontier[3]} ratePerMin={0.01} />);

    const chart = screen.getByRole('img', { name: /feedback time versus billed cost/i });
    expect(chart).toBeInTheDocument();
    expect(chart).toHaveAccessibleName(/recommended is 3 shards/i);
  });

  it('exposes the frontier data as a table for assistive tech', () => {
    render(<FrontierChart frontier={frontier} recommended={frontier[2]} ratePerMin={0.01} />);

    const table = screen.getByRole('table', { name: /cost\/time frontier/i });
    // One row per shard configuration (plus the header row).
    expect(within(table).getAllByRole('row')).toHaveLength(frontier.length + 1);
  });

  it('marks both the recommended and current configurations', () => {
    render(<FrontierChart frontier={frontier} recommended={frontier[2]} current={frontier[3]} ratePerMin={0.01} />);

    expect(screen.getByText(/recommended \(3\)/)).toBeInTheDocument();
    expect(screen.getByText(/current \(4\)/)).toBeInTheDocument();
  });
});
