/**
 * F10 — WizardCartRecap : économie + crédit + plancher (composant).
 *
 * Cible les frontières non couvertes par WizardCartRecap.welcome/coupon.test :
 * clamp crédit négatif, crédit == total, crédit > total (floor 0), devise AR
 * propagée, coexistence welcome + crédit, terracotta sur l'économie, panier vide.
 * cf. docs/coupon-loyalty-qa-ui-2026-06-03/10-cart-recap.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WizardCartRecap } from './WizardCartRecap';
import type { CartSnapshot } from '@/lib/checkout/schemas/common';

function cart(over: Partial<CartSnapshot> = {}): CartSnapshot {
  return {
    items: [{ sku: 'FEMI-KIT-100', name: 'Pack FemiGlow', quantity: 1, unitPriceCents: 19900, compareAtPriceCents: 28900, variantId: 'v1' }],
    totalCents: 19900,
    compareAtTotalCents: 28900,
    currency: 'MAD',
    ...over,
  } as CartSnapshot;
}

describe('F10 WizardCartRecap — crédit & frontières', () => {
  it('F10-C001 sans crédit : total inchangé, pas de ligne crédit', () => {
    render(<WizardCartRecap cart={cart()} />);
    expect(screen.getByTestId('wizard-cart-recap-total')).toHaveTextContent('199 MAD');
    expect(screen.queryByTestId('wizard-credit-line')).not.toBeInTheDocument();
  });

  it('F10-C002 crédit appliqué : total réduit + ligne crédit', () => {
    render(<WizardCartRecap cart={cart()} appliedCreditCents={2000} />);
    expect(screen.getByTestId('wizard-cart-recap-total')).toHaveTextContent('179 MAD');
    expect(screen.getByTestId('wizard-credit-line')).toHaveTextContent('−20 MAD');
  });

  it('F10-C003 crédit négatif → clampé à 0 (aucune ligne, total plein)', () => {
    render(<WizardCartRecap cart={cart()} appliedCreditCents={-50} />);
    expect(screen.getByTestId('wizard-cart-recap-total')).toHaveTextContent('199 MAD');
    expect(screen.queryByTestId('wizard-credit-line')).not.toBeInTheDocument();
  });

  it('F10-C004 crédit == total → total 0', () => {
    render(<WizardCartRecap cart={cart({ totalCents: 2000, compareAtTotalCents: undefined as never })} appliedCreditCents={2000} />);
    expect(screen.getByTestId('wizard-cart-recap-total')).toHaveTextContent('0 MAD');
  });

  it('F10-C005 crédit > total → plancher 0 (jamais négatif)', () => {
    render(<WizardCartRecap cart={cart({ totalCents: 1500, compareAtTotalCents: undefined as never })} appliedCreditCents={9999} />);
    expect(screen.getByTestId('wizard-cart-recap-total')).toHaveTextContent('0 MAD');
  });

  it('F10-C006 devise AR (درهم) propagée au total ET à la ligne crédit', () => {
    render(<WizardCartRecap cart={cart()} appliedCreditCents={2000} currencyLabel="درهم" />);
    expect(screen.getByTestId('wizard-cart-recap-total')).toHaveTextContent('179 درهم');
    expect(screen.getByTestId('wizard-credit-line')).toHaveTextContent('درهم');
  });

  it('F10-C007 coexistence welcome + crédit (lignes distinctes, INV-NONCUMUL affichage)', () => {
    render(<WizardCartRecap cart={cart()} welcomeCoupon={{ active: true }} appliedCreditCents={2000} />);
    expect(screen.getByTestId('wizard-welcome-coupon')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-welcome-economy')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-credit-line')).toBeInTheDocument();
  });

  it('F10-C008 économie en accent terracotta #C28A6E', () => {
    render(<WizardCartRecap cart={cart()} welcomeCoupon={{ active: true }} />);
    const eco = screen.getByTestId('wizard-welcome-economy');
    expect(eco.className).toContain('#C28A6E');
  });

  it('F10-C009 clin d’œil crédit forward si postPurchaseCreditCents > 0', () => {
    render(<WizardCartRecap cart={cart()} welcomeCoupon={{ active: true, postPurchaseCreditCents: 2000 }} />);
    expect(screen.getByTestId('wizard-welcome-forward')).toHaveTextContent('20 MAD');
  });

  it('F10-V010 charte : aucun %/!/emoji/compte à rebours dans le récap', () => {
    render(<WizardCartRecap cart={cart()} welcomeCoupon={{ active: true, postPurchaseCreditCents: 2000 }} appliedCreditCents={2000} />);
    const recap = screen.getByTestId('wizard-cart-recap');
    expect(recap.textContent ?? '').not.toMatch(/[%!]|🎉|⏰/);
  });

  it('F10-C011 panier vide → ne rend rien (null)', () => {
    const { container } = render(<WizardCartRecap cart={cart({ items: [] })} />);
    expect(container.firstChild).toBeNull();
  });
});
