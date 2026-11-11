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

describe('WizardCartRecap — prix barré livré (même règle que l’étape 2)', () => {
  const PROMO_CART: CartSnapshot = {
    items: [{ variantId: 'v', sku: 'FEMI-KIT-100', name: 'Kit FemiGlow', quantity: 1, unitPriceCents: 19900, compareAtPriceCents: 28900 }],
    totalCents: 19900,
    compareAtTotalCents: 28900,
    currency: 'MAD',
  };
  const strike = (container: HTMLElement) =>
    [...container.querySelectorAll('.line-through, s, del')].map((el) => el.textContent?.trim());

  it('sans code, ville connue : 289 + 35 = 324 barré à côté de 234', () => {
    const { container } = render(
      <WizardCartRecap cart={PROMO_CART} shippingCents={3500} priceCompareAt="289 MAD" />,
    );
    expect(screen.getByTestId('wizard-cart-recap-total')).toHaveTextContent('234 MAD');
    expect(strike(container)).toContain('324 MAD');
  });

  it('avec GLOW99 (−100), ville connue : 234 barré à côté de 134, l’écart est la remise du code', () => {
    const { container } = render(
      <WizardCartRecap cart={PROMO_CART} shippingCents={3500} appliedCreditCents={10000} priceCompareAt="289 MAD" />,
    );
    expect(screen.getByTestId('wizard-cart-recap-total')).toHaveTextContent('134 MAD');
    expect(strike(container)).toContain('234 MAD');
    expect(strike(container)).not.toContain('324 MAD');
  });

  it('ville inconnue : prix barré du kit, inchangé', () => {
    const { container } = render(
      <WizardCartRecap cart={PROMO_CART} shippingCents={null} appliedCreditCents={10000} priceCompareAt="289 MAD" />,
    );
    expect(strike(container)).toContain('289 MAD');
  });
});
