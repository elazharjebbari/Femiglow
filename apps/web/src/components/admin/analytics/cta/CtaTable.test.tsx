/**
 * Tests CtaTable — labels, label « (supprimé) », export CSV.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { CtaRow } from '@/lib/analytics/queries/cta';
import { CtaTable } from './CtaTable';

const ROWS: CtaRow[] = [
  {
    componentId: 'c1',
    label: 'Composer mon rituel',
    role: 'cta_primary',
    pageRoute: '/kit',
    impressions: 1200,
    clicks: 240,
    purchasesAttributed: 67,
    revenueAttributedCents: 320000,
    clickRate: 0.2,
    conversionRate: 0.279,
    isDeleted: false,
  },
  {
    componentId: 'c2',
    label: 'Old CTA',
    role: 'cta_secondary',
    pageRoute: '/legacy',
    impressions: 50,
    clicks: 5,
    purchasesAttributed: 1,
    revenueAttributedCents: 5000,
    clickRate: 0.1,
    conversionRate: 0.2,
    isDeleted: true,
  },
];

describe('CtaTable', () => {
  it('renders rows with label and currency', () => {
    render(<CtaTable rows={ROWS} />);
    expect(screen.getByText('Composer mon rituel')).toBeInTheDocument();
    // Symbole euro et 3 200,00 (ou similaire — tolérant)
    expect(screen.getByText(/3[\s\u202f\u00a0]?200/)).toBeInTheDocument();
  });

  it('marks deleted components with "(supprimé)"', () => {
    render(<CtaTable rows={ROWS} />);
    expect(screen.getByText('(supprimé)')).toBeInTheDocument();
  });

  it('exposes a CSV export button', () => {
    render(<CtaTable rows={ROWS} />);
    expect(screen.getByTestId('export-csv-button')).toBeInTheDocument();
  });

  it('shows empty state when no rows', () => {
    render(<CtaTable rows={[]} />);
    expect(screen.getByText(/Aucune impression, ni clic/i)).toBeInTheDocument();
  });
});
