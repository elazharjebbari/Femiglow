import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { StockAlert } from '@/lib/checkout/stock-status';

import { StockAlertBanner } from './StockAlertBanner';

const refused: StockAlert = {
  sku: 'FEMI-KIT-100',
  label: 'Pack',
  level: 'refused',
  effective: 0,
  thresholdLow: 5,
};
const low: StockAlert = { ...refused, sku: 'FEMI-KIT-200', level: 'low', effective: 3 };

describe('<StockAlertBanner/>', () => {
  it('ne rend rien sans alerte', () => {
    const { container } = render(<StockAlertBanner alerts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('annonce « commandes refusées » quand le stock effectif est à 0', () => {
    render(<StockAlertBanner alerts={[refused]} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Commandes refusées');
    expect(alert).toHaveTextContent('FEMI-KIT-100 (Pack) : stock effectif 0');
  });

  it('nomme l’absence de compteur', () => {
    render(<StockAlertBanner alerts={[{ ...refused, effective: null, thresholdLow: null }]} />);
    expect(screen.getByRole('alert')).toHaveTextContent('aucun compteur de stock');
  });

  it('distingue le stock bas, sans annoncer de refus', () => {
    render(<StockAlertBanner alerts={[low]} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Stock bas',
    );
    expect(screen.getByRole('status')).toHaveTextContent('stock effectif 3, seuil 5');
    expect(screen.queryByText('Commandes refusées')).not.toBeInTheDocument();
  });

  it('lie vers la fiche produit depuis la liste', () => {
    render(
      <StockAlertBanner
        alerts={[{ ...refused, productSlug: 'le-kit', productTitle: 'Le Kit' }]}
      />,
    );
    expect(
      within(screen.getByRole('alert')).getByRole('link', { name: 'Le Kit' }),
    ).toHaveAttribute('href', '/admin/products/le-kit');
  });

  it('signale un stock illisible', () => {
    render(<StockAlertBanner alerts={[]} unreadable />);
    expect(screen.getByRole('alert')).toHaveTextContent('Stock illisible');
  });
});
