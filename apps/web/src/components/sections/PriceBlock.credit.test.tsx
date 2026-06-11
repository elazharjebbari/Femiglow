/**
 * PriceBlock — propagation du crédit de fidélité (wizard-store) sur TOUS les
 * prix de /kit : prix XXL, badge économie, note geste d'accueil, ligne de
 * réduction dans le détail, prix du CTA. + flux d'application via le champ code
 * (MSW /api/coupons/redeem). cf. demande « actualiser tous les chiffres ».
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { PriceBlock } from './PriceBlock';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { server } from '@/test/msw/server';
import { redeemHandlers } from '@/test/msw/coupons-handlers';
import type { ProductFeed } from '@/lib/products/feed/types';
import type { Product } from '@/lib/schemas';

vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: vi.fn(), consent: { analytics: 'granted' } }),
}));
vi.mock('@/components/commerce/CommanderAnchorButton', () => ({
  CommanderAnchorButton: ({ children, priceCents }: { children: React.ReactNode; priceCents: number }) => (
    <button data-testid="kit-commander-anchor-button" data-price-cents={priceCents}>{children}</button>
  ),
}));

const product = {
  id: 'kit', slug: 'kit', name: 'Kit', description: 'd',
  priceCents: 3500, promoPriceCents: null, currency: 'EUR', inStock: true, images: [],
} as unknown as Product;

const productPromo = { ...product, priceCents: 4900, promoPriceCents: 3500 } as unknown as Product;

const hero: ProductFeed['hero'] = {
  kicker: 'Le pack', title: 'T', lead: 'L', pricePrefix: 'Tout compris :',
  ctaLabel: 'Commander', ctaMicrocopy: 'm', priceCompareAt: '49 €',
  valueBreakdown: [{ label: '1 Paste', valueLabel: '19 €' }],
  perUsageHint: '≈ 0,74 € par soin', ctaAccent: 'sauge-dark',
};
function feed(): ProductFeed {
  return {
    productSlug: 'kit', locale: 'fr-FR', canonicalUrl: 'x', imageUrl: 'x', brand: 'FemiGlow',
    currency: 'EUR', priceMajor: 35, promoPriceMajor: null, availability: 'in_stock',
    description: 'd', hero, steps: [], claims: [],
    socialProof: { reviewsCount: 287, rating: 4.8, quote: 'q', authorLabel: 'a', countLabelGeo: '287 maisons' },
  } as unknown as ProductFeed;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  useWizardStore.getState().clearCoupon();
  cleanup();
});
afterAll(() => server.close());

describe('PriceBlock — crédit appliqué (store)', () => {
  it('sans crédit : prix XXL = 35, pas de ligne de réduction', () => {
    render(<PriceBlock feed={feed()} product={product} />);
    expect(screen.getByTestId('pack-price-line').textContent).toMatch(/35/);
    expect(screen.queryByTestId('pack-value-credit-line')).toBeNull();
  });

  it('avec crédit 500c : prix XXL réduit à 30 + ligne de réduction « −5 »', () => {
    useWizardStore.setState({ creditCents: 500, couponCode: 'FG-X' });
    render(<PriceBlock feed={feed()} product={product} />);
    expect(screen.getByTestId('pack-price-line').textContent).toMatch(/30/);
    const line = screen.getByTestId('pack-value-credit-line');
    expect(line.textContent).toMatch(/−5/);
    expect(line.textContent).toMatch(/Crédit de fidélité/);
  });

  it('avec crédit : badge économie recalculé (vs barré 49 €)', () => {
    useWizardStore.setState({ creditCents: 500, couponCode: 'FG-X' });
    render(<PriceBlock feed={feed()} product={product} />);
    // économie totale = 49 − 30 = 19 €
    expect(screen.getByTestId('pack-savings-badge').textContent).toMatch(/19/);
  });

  it('avec crédit : le CTA reçoit le prix réduit', () => {
    useWizardStore.setState({ creditCents: 500, couponCode: 'FG-X' });
    render(<PriceBlock feed={feed()} product={product} />);
    expect(screen.getByTestId('kit-commander-anchor-button').getAttribute('data-price-cents')).toBe('3000');
  });

  it('crédit > prix : prix plancher à 0 (jamais négatif)', () => {
    useWizardStore.setState({ creditCents: 999999, couponCode: 'FG-X' });
    render(<PriceBlock feed={feed()} product={product} />);
    expect(screen.getByTestId('pack-price-line').textContent).toMatch(/\b0\b/);
  });
});

describe('PriceBlock — flux d’application du code (note geste d’accueil + MSW)', () => {
  it('saisir un code valide met à jour le store ET le prix XXL + ajoute la ligne', async () => {
    server.use(...redeemHandlers({ byCode: { 'FG-DEMO-1234': { valid: true, valueCents: 500 } } }));
    render(
      <PriceBlock feed={feed()} product={productPromo} welcomeCoupon={{ active: true, endsAt: null }} />,
    );
    // note geste d'accueil rendue → champ code présent
    fireEvent.change(screen.getByLabelText('Votre code'), { target: { value: 'FG-DEMO-1234' } });
    fireEvent.click(screen.getByText('Appliquer'));
    await screen.findByTestId('invitation-code-ok');
    // store mis à jour
    await waitFor(() => expect(useWizardStore.getState().creditCents).toBe(500));
    // prix XXL réduit (3500 → 3000) + ligne de réduction
    expect(screen.getByTestId('pack-price-line').textContent).toMatch(/30/);
    expect(screen.getByTestId('pack-value-credit-line')).toBeInTheDocument();
  });

  it('anti-stale : ré-éditer le code retire le crédit et restaure les prix', async () => {
    server.use(...redeemHandlers({ byCode: { 'FG-DEMO-1234': { valid: true, valueCents: 500 } } }));
    render(
      <PriceBlock feed={feed()} product={productPromo} welcomeCoupon={{ active: true, endsAt: null }} />,
    );
    const input = screen.getByLabelText('Votre code');
    fireEvent.change(input, { target: { value: 'FG-DEMO-1234' } });
    fireEvent.click(screen.getByText('Appliquer'));
    await screen.findByTestId('invitation-code-ok');
    await waitFor(() => expect(screen.getByTestId('pack-price-line').textContent).toMatch(/30/));
    // ré-édition → clearCoupon → prix restauré (3500 → 35) + ligne retirée
    fireEvent.change(input, { target: { value: 'FG-DEMO-123' } });
    await waitFor(() => expect(useWizardStore.getState().creditCents).toBe(0));
    expect(screen.getByTestId('pack-price-line').textContent).toMatch(/35/);
    expect(screen.queryByTestId('pack-value-credit-line')).toBeNull();
  });
});
