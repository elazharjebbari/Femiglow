/**
 * Tests FunnelDataTable — colonnes, formats, export CSV présent.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { FunnelByPageRow } from '@/lib/analytics/queries/funnel';
import { FunnelDataTable } from './FunnelDataTable';

const ROWS: FunnelByPageRow[] = [
  { pageRoute: '/kit', views: 8500, viewToCta: 0.142, ctaToBuy: 0.056, purchases: 67 },
  { pageRoute: '/rituel', views: 1200, viewToCta: 0.061, ctaToBuy: 0.08, purchases: 6 },
];

describe('FunnelDataTable', () => {
  it('renders rows with formatted percentages', () => {
    render(<FunnelDataTable rows={ROWS} />);
    expect(screen.getByText('/kit')).toBeInTheDocument();
    expect(screen.getByText('/rituel')).toBeInTheDocument();
    expect(screen.getByText(/^8\s500$/)).toBeInTheDocument();
    // 14,2 % et 5,6 % (FR)
    expect(screen.getByText(/14,2/)).toBeInTheDocument();
    expect(screen.getByText(/5,6/)).toBeInTheDocument();
  });

  it('exposes a CSV export button', () => {
    render(<FunnelDataTable rows={ROWS} />);
    expect(screen.getByTestId('export-csv-button')).toBeInTheDocument();
  });

  it('shows empty state when rows is []', () => {
    render(<FunnelDataTable rows={[]} />);
    expect(screen.getByText(/Aucune session avec une vue/i)).toBeInTheDocument();
  });
});
