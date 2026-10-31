/**
 * Tests `WizardCartRecap` — Server Component pur.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { WizardCartRecap } from './WizardCartRecap';
import type { CartSnapshot } from '@/lib/checkout/schemas/common';

afterEach(() => cleanup());

const baseCart: CartSnapshot = {
  items: [
    {
      sku: 'kit-femiglow',
      name: 'Pack FemiGlow',
      variantId: 'v1',
      unitPriceCents: 19900,
      quantity: 1,
    },
  ],
  totalCents: 19900,
  currency: 'MAD',
};

describe('WizardCartRecap', () => {
  it('rend label « 1 × Pack FemiGlow » + total', () => {
    render(<WizardCartRecap cart={baseCart} />);
    const recap = screen.getByTestId('wizard-cart-recap');
    expect(recap.textContent).toContain('1 × Pack FemiGlow');
    expect(screen.getByTestId('wizard-cart-recap-total').textContent).toBe(
      '199 MAD',
    );
  });

  it('rend le prix barré si priceCompareAt fourni', () => {
    render(<WizardCartRecap cart={baseCart} priceCompareAt="390 MAD" />);
    expect(
      screen.getByTestId('wizard-cart-recap-compare-at').textContent,
    ).toBe('390 MAD');
  });

  it('ne rend pas le prix barré si priceCompareAt absent', () => {
    render(<WizardCartRecap cart={baseCart} />);
    expect(
      screen.queryByTestId('wizard-cart-recap-compare-at'),
    ).toBeNull();
  });

  it('image thumbnail alt="" (décorative)', () => {
    render(<WizardCartRecap cart={baseCart} />);
    const img = screen
      .getByTestId('wizard-cart-recap')
      .querySelector('img');
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('image src par défaut /products/kit-principale.svg', () => {
    render(<WizardCartRecap cart={baseCart} />);
    const img = screen
      .getByTestId('wizard-cart-recap')
      .querySelector('img');
    expect(img?.getAttribute('src')).toBe('/products/kit-principale.png');
  });

  it('override thumbnailSrc via prop', () => {
    render(
      <WizardCartRecap cart={baseCart} thumbnailSrc="/custom-thumb.png" />,
    );
    const img = screen
      .getByTestId('wizard-cart-recap')
      .querySelector('img');
    expect(img?.getAttribute('src')).toBe('/custom-thumb.png');
  });

  it('dans la page, défile avec le contenu : en-tête et barre promo le recouvriraient', () => {
    render(<WizardCartRecap cart={baseCart} />);
    const recap = screen.getByTestId('wizard-cart-recap');
    expect(recap.className).not.toContain('sticky');
    expect(recap.className).toContain('sm:static');
  });

  it('dans le panneau, reste épinglé en haut', () => {
    render(<WizardCartRecap cart={baseCart} pinned />);
    expect(screen.getByTestId('wizard-cart-recap').className).toContain('sticky top-0 z-30');
  });

  it('role="region" + aria-label', () => {
    render(<WizardCartRecap cart={baseCart} />);
    const recap = screen.getByTestId('wizard-cart-recap');
    expect(recap.getAttribute('role')).toBe('region');
    expect(recap.getAttribute('aria-label')).toContain('Récapitulatif');
  });

  it('retourne null si cart vide', () => {
    const emptyCart: CartSnapshot = {
      items: [],
      totalCents: 0,
      currency: 'MAD',
    };
    const { container } = render(<WizardCartRecap cart={emptyCart} />);
    expect(container.firstChild).toBeNull();
  });

  it('multi-items : qty totale aggregée correctement', () => {
    const multi: CartSnapshot = {
      ...baseCart,
      items: [
        { ...baseCart.items[0]!, quantity: 2 },
      ],
      totalCents: 39800,
    };
    render(<WizardCartRecap cart={multi} />);
    expect(screen.getByTestId('wizard-cart-recap').textContent).toContain(
      '2 × Pack FemiGlow',
    );
  });
});
