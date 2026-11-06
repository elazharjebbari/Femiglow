import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { toAdminStockView } from '@/lib/checkout/stock-status';
import type { ProductVariant } from '@/lib/products/types';

import { VariantsEditor } from './VariantsEditor';

const variant: ProductVariant = {
  id: 'pvar_kit',
  productId: 'prod_kit',
  sku: 'FEMI-KIT-100',
  label: 'Le Kit',
  priceCents: 19900,
  promoPriceCents: null,
  currency: 'MAD',
  inventoryStatus: 'available',
  weightG: null,
  attributes: {},
  position: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const stock = toAdminStockView({
  variantId: variant.id,
  sku: variant.sku,
  available: 0,
  reserved: 0,
  thresholdLow: 5,
});

function renderEditor() {
  render(
    <VariantsEditor
      slug="le-kit"
      initialVariants={[variant]}
      stockByVariantId={{ [variant.id]: stock }}
      stockReadable
    />,
  );
}

describe('<VariantsEditor/> — stock', () => {
  it('montre le stock réel de la variante, distinct du statut catalogue', () => {
    renderEditor();
    expect(
      within(screen.getByTestId('variant-stock-FEMI-KIT-100')).getByText('out_of_stock'),
    ).toBeInTheDocument();
    expect(screen.getByText('Catalogue : available')).toBeInTheDocument();
  });

  it('nomme le sélecteur « Statut catalogue » et rappelle qu’il ne change pas la quantité', () => {
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Éditer' }));
    const select = screen.getByLabelText(/Statut catalogue \(flux produit\)/);
    expect(select.tagName).toBe('SELECT');
    expect(screen.getByLabelText(/Ne change pas la quantité vendable/)).toBe(select);
    expect(screen.queryByText(/^Stock$/)).not.toBeInTheDocument();
  });
});
