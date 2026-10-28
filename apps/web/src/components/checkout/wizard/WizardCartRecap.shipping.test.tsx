/** WizardCartRecap — livraison payante au tarif de la ville. */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WizardCartRecap } from './WizardCartRecap';
import type { CartSnapshot } from '@/lib/checkout/schemas/common';

const CART: CartSnapshot = {
  items: [{ variantId: 'v', sku: 'FEMI-KIT-100', name: 'Kit FemiGlow', quantity: 1, unitPriceCents: 9900 }],
  totalCents: 9900,
  currency: 'MAD',
};

describe('WizardCartRecap livraison', () => {
  it('ville connue → frais ajoutés au total + ligne « dont livraison »', () => {
    render(<WizardCartRecap cart={CART} shippingCents={3500} />);
    expect(screen.getByTestId('wizard-cart-recap-total')).toHaveTextContent('134 MAD');
    expect(screen.getByTestId('wizard-cart-recap-shipping')).toHaveTextContent('dont livraison 35 MAD');
  });

  it('ville pas encore saisie → total produit + « selon la ville »', () => {
    render(<WizardCartRecap cart={CART} shippingCents={null} />);
    expect(screen.getByTestId('wizard-cart-recap-total')).toHaveTextContent('99 MAD');
    expect(screen.getByTestId('wizard-cart-recap-shipping')).toHaveTextContent('selon la ville');
  });

  it('crédit plafonné au produit, livraison toujours due', () => {
    render(<WizardCartRecap cart={CART} appliedCreditCents={999999} shippingCents={1900} />);
    expect(screen.getByTestId('wizard-cart-recap-total')).toHaveTextContent('19 MAD');
  });
});
