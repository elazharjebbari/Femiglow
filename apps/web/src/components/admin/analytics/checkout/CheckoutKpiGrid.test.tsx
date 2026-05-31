/**
 * Tests CheckoutKpiGrid — 4 cards KPI + sous-total fallback.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CheckoutKpiTotals } from '@/lib/analytics/queries/checkout';
import { CheckoutKpiGrid } from './CheckoutKpiGrid';

const TOTALS: CheckoutKpiTotals = {
  viewCart: 234,
  beginCheckout: 145,
  submissions: 89,
  abandons: 56,
  serverFallbackPurchases: 4,
};

describe('CheckoutKpiGrid', () => {
  it('renders 4 KPI labels', () => {
    render(<CheckoutKpiGrid totals={TOTALS} />);
    expect(screen.getByText('Vues panier')).toBeInTheDocument();
    expect(screen.getByText('Begin checkout')).toBeInTheDocument();
    expect(screen.getByText('Achats')).toBeInTheDocument();
    expect(screen.getByText('Abandons')).toBeInTheDocument();
  });

  it('renders all numeric values', () => {
    render(<CheckoutKpiGrid totals={TOTALS} />);
    expect(screen.getByText('234')).toBeInTheDocument();
    expect(screen.getByText('145')).toBeInTheDocument();
    expect(screen.getByText('89')).toBeInTheDocument();
    expect(screen.getByText('56')).toBeInTheDocument();
  });

  it('shows server-fallback hint when > 0', () => {
    render(<CheckoutKpiGrid totals={TOTALS} />);
    expect(screen.getByText(/dont 4 via webhook/i)).toBeInTheDocument();
  });

  it('omits fallback hint when serverFallbackPurchases=0', () => {
    render(<CheckoutKpiGrid totals={{ ...TOTALS, serverFallbackPurchases: 0 }} />);
    expect(screen.queryByText(/via webhook/i)).not.toBeInTheDocument();
  });
});
