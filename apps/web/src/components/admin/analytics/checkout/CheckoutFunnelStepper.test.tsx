/**
 * Tests CheckoutFunnelStepper — labels 6 étapes + valeurs + état vide.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CheckoutFunnelStep } from '@/lib/analytics/queries/checkout';
import { CheckoutFunnelStepper } from './CheckoutFunnelStepper';

const STEPS: CheckoutFunnelStep[] = [
  { stage: 'view_cart', sessions: 234, progressionFromPrevious: null, dropoffToNext: 0.38 },
  { stage: 'begin_checkout', sessions: 145, progressionFromPrevious: 0.62, dropoffToNext: 0.09 },
  { stage: 'add_shipping', sessions: 132, progressionFromPrevious: 0.91, dropoffToNext: 0.11 },
  { stage: 'add_payment', sessions: 118, progressionFromPrevious: 0.89, dropoffToNext: 0.14 },
  { stage: 'submit', sessions: 102, progressionFromPrevious: 0.86, dropoffToNext: 0.13 },
  { stage: 'purchase', sessions: 89, progressionFromPrevious: 0.87, dropoffToNext: null },
];

describe('CheckoutFunnelStepper', () => {
  it('renders all 6 stage labels', () => {
    render(<CheckoutFunnelStepper steps={STEPS} />);
    for (const label of [
      'View Cart',
      'Begin Checkout',
      'Add Shipping',
      'Add Payment',
      'Submit',
      'Purchase',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('renders absolute session counts', () => {
    render(<CheckoutFunnelStepper steps={STEPS} />);
    expect(screen.getByText('234')).toBeInTheDocument();
    expect(screen.getByText('145')).toBeInTheDocument();
    expect(screen.getByText('89')).toBeInTheDocument();
  });

  it('shows empty state when baseline=0', () => {
    const empty = STEPS.map((s) => ({
      ...s,
      sessions: 0,
      progressionFromPrevious: null,
      dropoffToNext: null,
    }));
    render(<CheckoutFunnelStepper steps={empty} />);
    expect(screen.getByText(/Aucune session/i)).toBeInTheDocument();
  });
});
