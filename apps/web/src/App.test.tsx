import { render, screen, within } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the preloaded demo analysis', () => {
    render(<App />);

    // The app title and the analysis it computed in-browser are on screen.
    expect(screen.getByRole('heading', { level: 1, name: /CI Shard Advisor/i })).toBeInTheDocument();
    expect(screen.getByText(/12 tests/i)).toBeInTheDocument();
  });

  it('shows a recommendation with a shard count', () => {
    render(<App />);

    const recommendation = screen.getByRole('region', { name: /recommendation/i });
    // The recommended headline names a positive number of shards.
    expect(within(recommendation).getByText(/^\d+ shards$/, { selector: 'strong' })).toBeInTheDocument();
    expect(within(recommendation).getByText(/Feedback time/i)).toBeInTheDocument();
  });

  it('lists the sanity and regression blocks', () => {
    render(<App />);

    const blocks = screen.getByRole('region', { name: /blocks/i });
    expect(within(blocks).getByText('sanity')).toBeInTheDocument();
    expect(within(blocks).getByText('regression')).toBeInTheDocument();
  });
});
