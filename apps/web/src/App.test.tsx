import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

function reportFile(json: string, name: string): File {
  return new File([json], name, { type: 'application/json' });
}

/** A Cypress Module API report: one spec file per duration, unique per prefix. */
const cy = (durations: number[], prefix = 't'): string =>
  JSON.stringify({
    runs: durations.map((duration, i) => ({
      spec: { relative: `cypress/e2e/${prefix}${i}.cy.ts` },
      tests: [{ title: [`${prefix}${i}`, 'passes'], state: 'passed', duration }],
    })),
  });

describe('App', () => {
  it('loads the preloaded demo', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: /CI Shard Advisor/i })).toBeInTheDocument();
    expect(screen.getByText(/demo \(3 containers\)/i)).toBeInTheDocument();
    expect(screen.getByText(/of test time/i)).toBeInTheDocument();
  });

  it('shows the current situation as measured containers, with money', () => {
    render(<App />);
    const current = screen.getByRole('region', { name: /your setup today/i });
    expect(within(current).getByText(/measured/i)).toBeInTheDocument();
    expect(within(current).getByText(/^\d+ containers$/, { selector: 'strong' })).toBeInTheDocument();
    expect(within(current).getByText(/€\d+\.\d\d/)).toBeInTheDocument();
  });

  it('shows the free rebalance and the chosen move with cypress apply commands', () => {
    render(<App />);
    const moves = screen.getByRole('region', { name: /your moves/i });
    expect(within(moves).getByText(/rebalance your 3 containers/i)).toBeInTheDocument();
    expect(within(moves).getAllByText(/npx cypress run --spec/).length).toBeGreaterThanOrEqual(1);
    expect(within(moves).queryByText(/npx playwright test/)).not.toBeInTheDocument();
  });

  it('surfaces the flaky finding for the demo', () => {
    render(<App />);
    const findings = screen.getByRole('region', { name: /findings/i });
    expect(within(findings).getAllByText(/flaky test/i).length).toBeGreaterThanOrEqual(1);
  });

  it('exposes the CI-setup controls, without any workers knob', () => {
    render(<App />);
    expect(screen.getByLabelText(/startup overhead/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cost per minute/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/optimize for/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/workers/i)).not.toBeInTheDocument();
  });

  it('re-analyzes when the objective changes', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/optimize for/i), { target: { value: 'fastest' } });
    expect(screen.getByRole('region', { name: /your moves/i })).toBeInTheDocument();
  });

  it('prefills the wait limit with the measured current wait', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/optimize for/i), { target: { value: 'max-wait' } });
    const input = screen.getByLabelText(/wait limit/i) as HTMLInputElement;
    expect(Number(input.value)).toBeGreaterThan(0);
  });

  it('prefills the budget with the measured current cost', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/optimize for/i), { target: { value: 'budget' } });
    const input = screen.getByLabelText(/budget per run/i) as HTMLInputElement;
    expect(Number(input.value)).toBeGreaterThan(0);
  });

  it('re-anchors the wait-limit prefill when new reports change the measured wait', async () => {
    const user = userEvent.setup();
    render(<App />);
    fireEvent.change(screen.getByLabelText(/optimize for/i), { target: { value: 'max-wait' } });
    const before = Number((screen.getByLabelText(/wait limit/i) as HTMLInputElement).value);

    // A much slower measured situation → the prefill must follow the new anchor
    // (spec §5.4: prefilled with the CURRENT measured wait), not stay stale.
    await user.upload(screen.getByLabelText(/upload your cypress reports/i), [
      reportFile(cy([600000, 600000], 'a'), 'container-1.json'),
      reportFile(cy([600000], 'b'), 'container-2.json'),
    ]);
    const after = Number((await screen.findByLabelText(/wait limit/i) as HTMLInputElement).value);
    expect(after).toBeGreaterThan(before);
  });

  it('the prefilled budget always admits the current cost (never rounds it out)', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/optimize for/i), { target: { value: 'budget' } });
    // With the default budget (= current cost, rounded up) the chosen move must
    // exist: at worst it coincides with the free rebalance — never "not available".
    const moves = screen.getByRole('region', { name: /your moves/i });
    expect(within(moves).queryByText(/not available/i)).not.toBeInTheDocument();
  });

  it('merges into one card when the chosen move IS the rebalance', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Two equal one-spec containers → fastest = 2 containers = the rebalance point.
    await user.upload(screen.getByLabelText(/upload your cypress reports/i), [
      reportFile(cy([60000], 'a'), 'a.json'),
      reportFile(cy([60000], 'b'), 'b.json'),
    ]);
    fireEvent.change(screen.getByLabelText(/optimize for/i), { target: { value: 'fastest' } });
    const moves = screen.getByRole('region', { name: /your moves/i });
    // Move cards are the named list items (plan entries inside carry no name).
    expect(within(moves).getAllByRole('listitem', { name: /./ })).toHaveLength(1);
    expect(within(moves).getByText(/your best move is free/i)).toBeInTheDocument();
  });

  it('only asks for the container count when a single merged report is loaded', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Demo = one report per container → N is deduced, the field is hidden.
    expect(screen.queryByLabelText(/containers you run today/i)).not.toBeInTheDocument();

    await user.upload(
      screen.getByLabelText(/upload your cypress reports/i),
      reportFile(cy([50000, 10000]), 'all.json'),
    );
    expect(await screen.findByLabelText(/containers you run today/i)).toBeInTheDocument();
  });

  it('analyzes several uploaded container reports as a measured setup', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.upload(screen.getByLabelText(/upload your cypress reports/i), [
      reportFile(cy([50000, 50000], 'a'), 'container-1.json'),
      reportFile(cy([10000, 10000], 'b'), 'container-2.json'),
    ]);

    expect(await screen.findByText(/2 uploaded reports/i)).toBeInTheDocument();
    const current = screen.getByRole('region', { name: /your setup today/i });
    expect(within(current).getByText(/measured/i)).toBeInTheDocument();
  });

  it('shows an error for a malformed report', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.upload(
      screen.getByLabelText(/upload your cypress reports/i),
      reportFile('{ not json', 'broken.json'),
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('states that reports are processed in the browser', () => {
    render(<App />);
    expect(screen.getByText(/never uploaded/i)).toBeInTheDocument();
  });
});
