/**
 * Tests primitives KpiCard.
 * cf. docs/analytics/06-tests-strategy.md §3.1
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { KpiCard } from './KpiCard';

describe('KpiCard', () => {
  it('renders label and formatted value', () => {
    render(<KpiCard label="Sessions" value={12340} format="number" />);
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText(/12.340/)).toBeInTheDocument(); // narrow nbsp
  });

  it('renders em-dash when value is null', () => {
    render(<KpiCard label="Conv." value={null} format="percent" />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows skeleton in loading state', () => {
    render(<KpiCard label="Sessions" value={100} loading />);
    expect(screen.getByTestId('kpi-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('100')).not.toBeInTheDocument();
  });

  it('renders delta with arrow', () => {
    render(
      <KpiCard
        label="Sessions"
        value={100}
        delta={{ value: 0.124 }}
        comparisonLabel="vs hier"
      />,
    );
    expect(screen.getByText(/↑/)).toBeInTheDocument();
    expect(screen.getByText(/12,4/)).toBeInTheDocument();
    expect(screen.getByText('vs hier')).toBeInTheDocument();
  });

  it('uses positiveDirection=down for inverted KPIs (bounce_rate)', () => {
    const { container } = render(
      <KpiCard
        label="Bounce"
        value={0.5}
        format="percent"
        delta={{ value: 0.1 }}
        positiveDirection="down"
      />,
    );
    // direction=up but positiveDirection=down → red
    const deltaP = container.querySelector('p.text-rose-600');
    expect(deltaP).not.toBeNull();
  });

  it('uses positiveDirection=up: positive delta is green', () => {
    const { container } = render(
      <KpiCard
        label="Sessions"
        value={100}
        delta={{ value: 0.1 }}
        positiveDirection="up"
      />,
    );
    const deltaP = container.querySelector('p.text-emerald-600');
    expect(deltaP).not.toBeNull();
  });

  it('wraps in Link when href is provided', () => {
    render(<KpiCard label="Sessions" value={100} href="/admin/analytics/funnel" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/admin/analytics/funnel');
  });

  it('does not wrap in Link without href', () => {
    render(<KpiCard label="Sessions" value={100} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
