/** CKV-D1 — WizardCartRecap : ligne « geste d'accueil » + économie absolue. */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WizardCartRecap } from './WizardCartRecap';
import type { CartSnapshot } from '@/lib/checkout/schemas/common';

const CART: CartSnapshot = {
  items: [{ variantId: 'v', sku: 'FEMI-KIT-100', name: 'Pack FemiGlow', quantity: 1, unitPriceCents: 19900 }],
  totalCents: 19900,
  compareAtTotalCents: 28900,
  currency: 'MAD',
};

describe('CKV-D1 WizardCartRecap — coupon d’accueil', () => {
  it('W1/W2 coupon actif → ligne visible + économie absolue 90 MAD', () => {
    render(<WizardCartRecap cart={CART} welcomeCoupon={{ active: true }} />);
    const line = screen.getByTestId('wizard-welcome-coupon');
    expect(line).toBeInTheDocument();
    expect(screen.getByTestId('wizard-welcome-economy')).toHaveTextContent('Économie 90 MAD');
  });

  it('W3 accent économie en terracotta, jamais de rouge ni de %', () => {
    render(<WizardCartRecap cart={CART} welcomeCoupon={{ active: true }} />);
    const eco = screen.getByTestId('wizard-welcome-economy');
    expect(eco.className).toContain('#C28A6E');
    expect(eco.className).not.toMatch(/red/);
    expect(screen.getByTestId('wizard-welcome-coupon').textContent).not.toContain('%');
  });

  it('W4 coupon inactif → ligne absente (non-régression)', () => {
    render(<WizardCartRecap cart={CART} welcomeCoupon={{ active: false }} />);
    expect(screen.queryByTestId('wizard-welcome-coupon')).toBeNull();
    expect(screen.getByTestId('wizard-cart-recap-total')).toHaveTextContent('199 MAD');
  });

  it('W4b prop absente → ligne absente (défaut inchangé)', () => {
    render(<WizardCartRecap cart={CART} />);
    expect(screen.queryByTestId('wizard-welcome-coupon')).toBeNull();
  });

  it('W5 pas de compareAt → ligne absente même si actif', () => {
    const noCompare: CartSnapshot = { ...CART, compareAtTotalCents: undefined };
    render(<WizardCartRecap cart={noCompare} welcomeCoupon={{ active: true }} />);
    expect(screen.queryByTestId('wizard-welcome-coupon')).toBeNull();
  });

  it('W6 charte : pas de « ! », pas d’emoji, pas de « promo/réduction »', () => {
    render(<WizardCartRecap cart={CART} welcomeCoupon={{ active: true }} />);
    const txt = screen.getByTestId('wizard-welcome-coupon').textContent ?? '';
    expect(txt).not.toContain('!');
    expect(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(txt)).toBe(false);
    expect(txt.toLowerCase()).not.toMatch(/promo|réduction|reduction|deal/);
  });

  it('W7 cumul crédit fidélité : welcome + ligne crédit coexistent, total 179', () => {
    render(<WizardCartRecap cart={CART} welcomeCoupon={{ active: true }} appliedCreditCents={2000} />);
    expect(screen.getByTestId('wizard-welcome-coupon')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-credit-line')).toBeInTheDocument();
    expect(screen.getByTestId('wizard-cart-recap-total')).toHaveTextContent('179 MAD');
  });

  it('W8 i18n : libellés injectés (ar) respectés', () => {
    render(
      <WizardCartRecap
        cart={CART}
        welcomeCoupon={{ active: true }}
        welcomeLabel="لقد تم تطبيق هدية الترحيب الخاصة بك"
        economyLabel={(a) => `توفير ${a}`}
        currencyLabel="درهم"
      />,
    );
    expect(screen.getByTestId('wizard-welcome-economy')).toHaveTextContent('توفير 90 درهم');
  });

  it('W9 coche de succès (svg) présente dans la mention', () => {
    render(<WizardCartRecap cart={CART} welcomeCoupon={{ active: true }} />);
    expect(screen.getByTestId('wizard-welcome-coupon').querySelector('svg')).not.toBeNull();
  });

  it('W10 clin d’œil crédit fidélité affiché si template actif', () => {
    render(
      <WizardCartRecap cart={CART} welcomeCoupon={{ active: true, postPurchaseCreditCents: 2000 }} />,
    );
    const fwd = screen.getByTestId('wizard-welcome-forward');
    expect(fwd).toHaveTextContent('20 MAD');
    expect(fwd.textContent).not.toContain('%');
  });

  it('W11 pas de clin d’œil si crédit post-achat absent (0)', () => {
    render(<WizardCartRecap cart={CART} welcomeCoupon={{ active: true, postPurchaseCreditCents: 0 }} />);
    expect(screen.queryByTestId('wizard-welcome-forward')).toBeNull();
  });

  it('W12 mobile : économie « −90 MAD » insécable présente', () => {
    render(<WizardCartRecap cart={CART} welcomeCoupon={{ active: true }} />);
    expect(screen.getByTestId('wizard-welcome-economy')).toHaveTextContent('−90 MAD');
  });
});
