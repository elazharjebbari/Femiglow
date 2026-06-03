/** FE-S4 — WizardCartRecap : total ajusté + ligne crédit (Phase 3). */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WizardCartRecap } from './WizardCartRecap';
import type { CartSnapshot } from '@/lib/checkout/schemas/common';

const CART: CartSnapshot = {
  items: [{ variantId: 'v', sku: 'FEMI-KIT-100', name: 'Kit FemiGlow', quantity: 1, unitPriceCents: 19900 }],
  totalCents: 19900,
  currency: 'MAD',
};

describe('FE-S4 WizardCartRecap crédit', () => {
  it('U001 sans crédit → total inchangé, pas de ligne crédit (non-régression)', () => {
    render(<WizardCartRecap cart={CART} />);
    expect(screen.getByTestId('wizard-cart-recap-total')).toHaveTextContent('199 MAD');
    expect(screen.queryByTestId('wizard-credit-line')).toBeNull();
  });

  it('U002 crédit 2000 → total 179 + ligne crédit −20 MAD', () => {
    render(<WizardCartRecap cart={CART} appliedCreditCents={2000} />);
    expect(screen.getByTestId('wizard-cart-recap-total')).toHaveTextContent('179 MAD');
    expect(screen.getByTestId('wizard-credit-line')).toHaveTextContent('20 MAD');
  });

  it('U003 crédit > total → total plafonné à 0', () => {
    render(<WizardCartRecap cart={CART} appliedCreditCents={999999} />);
    expect(screen.getByTestId('wizard-cart-recap-total')).toHaveTextContent('0 MAD');
  });
});
