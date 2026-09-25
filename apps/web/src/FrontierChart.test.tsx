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

/** jsdom lays nothing out: this observer reports the figure at a fixed width. */
function observeWidth(width: number) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
      }
      observe() {
        this.callback([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      disconnect() {}
    },
  );
}

describe('FrontierChart', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders an accessible chart describing the recommendation', () => {
    render(<FrontierChart frontier={frontier} recommended={frontier[2]} current={frontier[3]} ratePerMin={0.01} />);

    const chart = screen.getByRole('img', { name: /feedback time versus billed cost/i });
    expect(chart).toBeInTheDocument();
    expect(chart).toHaveAccessibleName(/recommended is 3 containers/i);
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

  it('draws at its rendered width, so its labels keep their size on a phone', () => {
    observeWidth(320);
    render(<FrontierChart frontier={frontier} recommended={frontier[2]} ratePerMin={0.01} />);

    // One viewBox unit per CSS pixel (and a taller aspect): nothing is scaled down.
    const chart = screen.getByRole('img', { name: /feedback time versus billed cost/i });
    expect(chart).toHaveAttribute('viewBox', '0 0 320 272');
  });

  it('keeps the desktop layout where nothing has been laid out yet', () => {
    render(<FrontierChart frontier={frontier} recommended={frontier[2]} ratePerMin={0.01} />);

    const chart = screen.getByRole('img', { name: /feedback time versus billed cost/i });
    expect(chart).toHaveAttribute('viewBox', '0 0 640 360');
  });
});
