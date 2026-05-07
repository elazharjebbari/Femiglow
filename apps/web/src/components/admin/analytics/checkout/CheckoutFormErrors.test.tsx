/**
 * Tests CheckoutFormErrors — labels colonnes + lignes + export CSV.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CheckoutFormError } from '@/lib/analytics/queries/checkout';
import { CheckoutFormErrors } from './CheckoutFormErrors';

const ROWS: CheckoutFormError[] = [
  { fieldId: 'email', errorCode: 'required', occurrences: 12, affectedSessions: 9 },
  { fieldId: 'address', errorCode: 'required', occurrences: 5, affectedSessions: 5 },
];

describe('CheckoutFormErrors', () => {
  it('renders rows with field, code, occurrences', () => {
    render(<CheckoutFormErrors rows={ROWS} />);
    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.getByText('address')).toBeInTheDocument();
    expect(screen.getAllByText('required').length).toBeGreaterThan(0);
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('exposes a CSV export button', () => {
    render(<CheckoutFormErrors rows={ROWS} />);
    expect(screen.getByTestId('export-csv-button')).toBeInTheDocument();
  });

  it('shows empty state when no rows', () => {
    render(<CheckoutFormErrors rows={[]} />);
    expect(screen.getByText(/Aucune erreur de validation formulaire/i)).toBeInTheDocument();
  });
});
