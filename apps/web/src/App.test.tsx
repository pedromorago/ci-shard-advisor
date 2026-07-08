import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

/** Build a File the way a browser hands one to a file input. */
function reportFile(json: string, name = 'report.json'): File {
  return new File([json], name, { type: 'application/json' });
}

const twoTestReport = JSON.stringify({
  suites: [
    {
      specs: [
        { title: 'a', tests: [{ results: [{ duration: 1000 }] }] },
        { title: 'b', tests: [{ results: [{ duration: 2000 }] }] },
      ],
    },
  ],
});

describe('App', () => {
  it('renders the preloaded demo analysis', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: /CI Shard Advisor/i })).toBeInTheDocument();
    expect(screen.getByText(/demo report/i)).toBeInTheDocument();
    expect(screen.getByText(/12 tests/i)).toBeInTheDocument();
  });

  it('shows a recommendation with a shard count', () => {
    render(<App />);

    const recommendation = screen.getByRole('region', { name: /recommendation/i });
    expect(within(recommendation).getByText(/^\d+ shards$/, { selector: 'strong' })).toBeInTheDocument();
    expect(within(recommendation).getByText(/Feedback time/i)).toBeInTheDocument();
  });

  it('lists the sanity and regression blocks', () => {
    render(<App />);

    const blocks = screen.getByRole('region', { name: /blocks/i });
    expect(within(blocks).getByText('sanity')).toBeInTheDocument();
    expect(within(blocks).getByText('regression')).toBeInTheDocument();
  });

  it('states that the report is processed in the browser', () => {
    render(<App />);
    expect(screen.getByText(/never uploaded/i)).toBeInTheDocument();
  });

  it('analyzes an uploaded report and shows its source', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText(/upload a test report/i);
    await user.upload(input, reportFile(twoTestReport, 'my-suite.json'));

    expect(await screen.findByText(/my-suite\.json/)).toBeInTheDocument();
    expect(screen.getByText(/2 tests/i)).toBeInTheDocument();
    // The demo analysis (12 tests) has been replaced.
    expect(screen.queryByText(/12 tests/i)).not.toBeInTheDocument();
  });

  it('auto-detects and analyzes a Cypress report', async () => {
    const user = userEvent.setup();
    render(<App />);

    // A Cypress run result (top-level `runs`), no format hint needed.
    const cypressReport = JSON.stringify({
      runs: [
        {
          spec: { relative: 'a.cy.ts' },
          tests: [
            { title: ['A', 't1'], state: 'passed', duration: 1000 },
            { title: ['A', 't2'], state: 'passed', duration: 2000 },
            { title: ['A', 't3'], state: 'passed', duration: 3000 },
          ],
        },
      ],
    });
    const input = screen.getByLabelText(/upload a test report/i);
    await user.upload(input, reportFile(cypressReport, 'cypress-run.json'));

    expect(await screen.findByText(/cypress-run\.json/)).toBeInTheDocument();
    expect(screen.getByText(/3 tests/i)).toBeInTheDocument();
  });

  it('auto-detects and analyzes a JUnit XML report', async () => {
    const user = userEvent.setup();
    render(<App />);

    const junit =
      '<testsuites><testsuite name="s"><testcase name="t1" time="1"/><testcase name="t2" time="2"/></testsuite></testsuites>';
    const file = new File([junit], 'results.xml', { type: 'application/xml' });
    const input = screen.getByLabelText(/upload a test report/i);
    await user.upload(input, file);

    expect(await screen.findByText(/results\.xml/)).toBeInTheDocument();
    expect(screen.getByText(/2 tests/i)).toBeInTheDocument();
  });

  it('shows an error for a malformed report and keeps the previous analysis', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText(/upload a test report/i);
    await user.upload(input, reportFile('{ not valid json', 'broken.json'));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // The demo analysis is still on screen.
    expect(screen.getByText(/demo report/i)).toBeInTheDocument();
  });

  it('restores the demo after loading a report', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByLabelText(/upload a test report/i);
    await user.upload(input, reportFile(twoTestReport, 'my-suite.json'));
    expect(await screen.findByText(/my-suite\.json/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /load demo/i }));
    expect(screen.getByText(/demo report/i)).toBeInTheDocument();
    expect(screen.getByText(/12 tests/i)).toBeInTheDocument();
  });
});
