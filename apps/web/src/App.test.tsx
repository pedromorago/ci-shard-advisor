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

  it('shows the free rebalance and the chosen move (merged when they coincide)', () => {
    render(<App />);
    const moves = screen.getByRole('region', { name: /your moves/i });
    // With the real demo the recommended knee IS the rebalance point → one card.
    expect(within(moves).getByText(/rebalance your 4 shards/i)).toBeInTheDocument();
    // The apply block lists a runnable command per shard.
    expect(within(moves).getAllByText(/npx playwright test /).length).toBeGreaterThanOrEqual(1);
    expect(moves.querySelectorAll('.moves-list > li')).toHaveLength(1); // merged card
  });

  it('splits into two cards when the chosen move differs from rebalance', () => {
    render(<App />);
    // "Fastest" on the demo picks more shards than the current 4 → two cards.
    fireEvent.change(screen.getByLabelText(/optimize for/i), { target: { value: 'fastest' } });
    const moves = screen.getByRole('region', { name: /your moves/i });
    const cards = [...moves.querySelectorAll('.moves-list > li.move')];
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Free');
    expect(cards[1]).toHaveTextContent('Fastest');
  });

  it('prefills the wait limit with the measured current wait', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/optimize for/i), { target: { value: 'max-wait' } });
    const input = screen.getByLabelText(/wait limit/i) as HTMLInputElement;
    // Demo current feedback ≈ 50s → prefilled with your situation, not a magic number.
    expect(Number(input.value)).toBeGreaterThan(0);
  });

  it('prefills the budget with the measured current cost', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/optimize for/i), { target: { value: 'budget' } });
    const input = screen.getByLabelText(/budget per run/i) as HTMLInputElement;
    expect(Number(input.value)).toBeGreaterThan(0);
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

  it('only asks for the shard count when a single merged report is loaded', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Demo = one report per shard → N is deduced, the field is hidden.
    expect(screen.queryByLabelText(/shards you run today/i)).not.toBeInTheDocument();

    await user.upload(screen.getByLabelText(/upload your shard reports/i), reportFile(pw([50000, 10000]), 'all.json'));
    expect(await screen.findByLabelText(/shards you run today/i)).toBeInTheDocument();
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

  it('loads the Cypress demo: measured containers, flaky finding, --spec commands', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /demo: cypress/i }));

    expect(screen.getByText(/demo · Cypress \(3 containers\)/i)).toBeInTheDocument();
    const current = screen.getByRole('region', { name: /your setup today/i });
    expect(within(current).getByText(/measured/i)).toBeInTheDocument();
    // The flaky retry burns machine time → the flaky finding shows up.
    const findings = screen.getByRole('region', { name: /findings/i });
    expect(within(findings).getAllByText(/flaky test/i).length).toBeGreaterThanOrEqual(1);
    // Apply commands are Cypress's, not Playwright's.
    const moves = screen.getByRole('region', { name: /your moves/i });
    expect(within(moves).getAllByText(/npx cypress run --spec/).length).toBeGreaterThanOrEqual(1);
    expect(within(moves).queryByText(/npx playwright test/)).not.toBeInTheDocument();
  });

  it('states that reports are processed in the browser', () => {
    render(<App />);
    expect(screen.getByText(/never uploaded/i)).toBeInTheDocument();
  });
});
