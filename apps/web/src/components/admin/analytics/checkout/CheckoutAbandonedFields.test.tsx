/**
 * Tests CheckoutAbandonedFields — labels + valeurs + état vide.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CheckoutAbandonedField } from '@/lib/analytics/queries/checkout';
import { CheckoutAbandonedFields } from './CheckoutAbandonedFields';

const ROWS: CheckoutAbandonedField[] = [
  { lastField: 'card_number', abandons: 12 },
  { lastField: 'cvc', abandons: 5 },
];

describe('CheckoutAbandonedFields', () => {
  it('renders field labels and abandon counts', () => {
    render(<CheckoutAbandonedFields rows={ROWS} />);
    expect(screen.getByText('card_number')).toBeInTheDocument();
    expect(screen.getByText('cvc')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows empty state when no rows', () => {
    render(<CheckoutAbandonedFields rows={[]} />);
    expect(screen.getByText(/Aucun abandon formulaire/i)).toBeInTheDocument();
  });
});
