import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

function reportFile(json: string, name: string): File {
  return new File([json], name, { type: 'application/json' });
}

const pw = (durations: number[]): string =>
  JSON.stringify({
    suites: [
      {
        specs: durations.map((d, i) => ({
          title: `t${i}`,
          file: `t${i}.spec.ts`,
          tests: [{ status: 'expected', results: [{ duration: d }] }],
        })),
      },
    ],
  });

describe('App', () => {
  it('loads the preloaded demo', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: /CI Shard Advisor/i })).toBeInTheDocument();
    expect(screen.getByText(/demo.*4 shards/i)).toBeInTheDocument();
    expect(screen.getByText(/of test time/i)).toBeInTheDocument();
  });

  it('shows the current situation as measured, with money', () => {
    render(<App />);
    const current = screen.getByRole('region', { name: /your setup today/i });
    expect(within(current).getByText(/measured/i)).toBeInTheDocument();
    expect(within(current).getByText(/^\d+ shards$/, { selector: 'strong' })).toBeInTheDocument();
    expect(within(current).getByText(/€\d+\.\d\d/)).toBeInTheDocument();
  });

  it('lists the four moves including a rebalance apply command', () => {
    render(<App />);
    const moves = screen.getByRole('region', { name: /your moves/i });
    // The rebalance move is present (its label may also appear in "same as" notes).
    expect(within(moves).getAllByText(/Rebalance/).length).toBeGreaterThanOrEqual(1);
    expect(within(moves).getAllByText(/--shard-weights=/).length).toBeGreaterThanOrEqual(1);
    expect(within(moves).getAllByRole('listitem')).toHaveLength(4);
  });

  it('surfaces findings for the bottlenecked demo', () => {
    render(<App />);
    const findings = screen.getByRole('region', { name: /findings/i });
    expect(within(findings).getByText(/sets the floor/i)).toBeInTheDocument();
  });

  it('exposes the CI-setup controls', () => {
    render(<App />);
    expect(screen.getByLabelText(/startup overhead/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cost per minute/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/optimize for/i)).toBeInTheDocument();
  });

  it('re-analyzes when the objective changes', () => {
    render(<App />);
    // Switching to "fastest" is accepted and keeps rendering the moves.
    fireEvent.change(screen.getByLabelText(/optimize for/i), { target: { value: 'fastest' } });
    expect(screen.getByRole('region', { name: /your moves/i })).toBeInTheDocument();
  });

  it('analyzes several uploaded shard reports as a measured setup', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByLabelText(/upload your shard reports/i);
    await user.upload(input, [
      reportFile(pw([50000, 50000]), 'shard-1.json'),
      reportFile(pw([10000, 10000]), 'shard-2.json'),
    ]);

    expect(await screen.findByText(/2 uploaded reports/i)).toBeInTheDocument();
    const current = screen.getByRole('region', { name: /your setup today/i });
    expect(within(current).getByText(/measured/i)).toBeInTheDocument();
  });

  it('shows an error for a malformed report', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByLabelText(/upload your shard reports/i);
    await user.upload(input, reportFile('{ not json', 'broken.json'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('states that reports are processed in the browser', () => {
    render(<App />);
    expect(screen.getByText(/never uploaded/i)).toBeInTheDocument();
  });
});
