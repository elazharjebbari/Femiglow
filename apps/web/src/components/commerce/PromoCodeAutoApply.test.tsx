/**
 * `PromoCodeAutoApply` — application automatique du code de l'URL de campagne
 * (`/kit?code=GLOW99`) et reprise du code mémorisé après rechargement.
 * MSW sur /api/coupons/redeem ; `next/navigation` mocké pour piloter l'URL.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { server } from '@/test/msw/server';
import { redeemHandlers } from '@/test/msw/coupons-handlers';

let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

// Import APRÈS le mock pour que le composant voie `useSearchParams` mocké.
const { PromoCodeAutoApply, readUrlCode } = await import('./PromoCodeAutoApply');

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  search = '';
  useWizardStore.getState().reset();
  useWizardStore.setState({ hydrated: true });
});
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

const state = () => useWizardStore.getState();

describe('readUrlCode', () => {
  it('lit code, promo ou coupon (premier renseigné), trim + MAJUSCULES, ignore < 3 caractères', () => {
    expect(readUrlCode(new URLSearchParams('code= glow99 '))).toBe('GLOW99');
    expect(readUrlCode(new URLSearchParams('promo=fg-x123'))).toBe('FG-X123');
    expect(readUrlCode(new URLSearchParams('coupon=ab'))).toBeNull();
    expect(readUrlCode(new URLSearchParams('utm_source=meta'))).toBeNull();
    expect(readUrlCode(null)).toBeNull();
  });
});

describe('PromoCodeAutoApply', () => {
  it('URL ?code=GLOW99 valide → store {GLOW99, 10000, promo}', async () => {
    server.use(
      ...redeemHandlers({
        byCode: { GLOW99: { valid: true, valueCents: 10000, kind: 'promo' } as never },
      }),
    );
    search = 'code=glow99&utm_source=meta';
    render(<PromoCodeAutoApply />);
    await waitFor(() => expect(state().creditCents).toBe(10000));
    expect(state().couponCode).toBe('GLOW99');
    expect(state().couponKind).toBe('promo');
  });

  it('URL avec code invalide → rien n’est appliqué, pas de boucle de re-tentative', async () => {
    const calls: string[] = [];
    server.use(...redeemHandlers({ byCode: {} }));
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/api/coupons/redeem')) calls.push(request.url);
    });
    search = 'code=NOPE99';
    const { rerender } = render(<PromoCodeAutoApply />);
    await waitFor(() => expect(calls.length).toBe(1));
    rerender(<PromoCodeAutoApply />);
    await new Promise((r) => setTimeout(r, 50));
    expect(calls.length).toBe(1);
    expect(state().couponCode).toBeNull();
    expect(state().creditCents).toBe(0);
  });

  it('reprise : couponCode mémorisé sans montant → re-validé et montant restauré', async () => {
    server.use(
      ...redeemHandlers({ byCode: { 'FG-SAUGE-7212': { valid: true, valueCents: 2000 } } }),
    );
    useWizardStore.setState({ couponCode: 'FG-SAUGE-7212', creditCents: 0, couponKind: 'credit' });
    render(<PromoCodeAutoApply />);
    await waitFor(() => expect(state().creditCents).toBe(2000));
    expect(state().couponKind).toBe('credit');
  });

  it('reprise : code mémorisé devenu invalide → retiré du store (pas de réduction fantôme)', async () => {
    server.use(...redeemHandlers({ byCode: {} }));
    useWizardStore.setState({ couponCode: 'GLOW99', creditCents: 0, couponKind: 'promo' });
    render(<PromoCodeAutoApply />);
    await waitFor(() => expect(state().couponCode).toBeNull());
    expect(state().couponKind).toBeNull();
  });

  it('code déjà appliqué → RE-VALIDÉ au montage (un code expiré ne doit pas survivre)', async () => {
    // `creditCents` est désormais persisté : sans re-validation, un code
    // expiré entre deux visites resterait affiché et la commande partirait
    // avec un total que le serveur refuse (422 price_mismatch).
    const calls: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/api/coupons/redeem')) calls.push(request.url);
    });
    server.use(
      ...redeemHandlers({
        byCode: { GLOW99: { valid: true, valueCents: 10000, kind: 'promo' } as never },
      }),
    );
    useWizardStore.setState({ couponCode: 'GLOW99', creditCents: 10000, couponKind: 'promo' });
    search = 'code=GLOW99';
    render(<PromoCodeAutoApply />);
    await waitFor(() => expect(calls.length).toBe(1));
    expect(state().creditCents).toBe(10000);
  });

  it('code mémorisé devenu invalide → remise retirée (pas de prix fantôme)', async () => {
    server.use(...redeemHandlers({ byCode: {} }));
    useWizardStore.setState({ couponCode: 'GLOW99', creditCents: 10000, couponKind: 'promo' });
    render(<PromoCodeAutoApply />);
    await waitFor(() => expect(state().couponCode).toBeNull());
    expect(state().creditCents).toBe(0);
  });

  it.each([['network' as const], [500], [503]])(
    'panne %s → la remise déjà appliquée est CONSERVÉE',
    async (mode) => {
      // Régression : une panne effaçait le code et la cliente payait le prix
      // plein alors qu'elle avait vu la remise s'appliquer.
      server.use(...redeemHandlers({ fail: mode }));
      useWizardStore.setState({ couponCode: 'GLOW99', creditCents: 10000, couponKind: 'promo' });
      render(<PromoCodeAutoApply />);
      await new Promise((r) => setTimeout(r, 80));
      expect(state().couponCode).toBe('GLOW99');
      expect(state().creditCents).toBe(10000);
    },
  );

  it('montant serveur différent du montant mémorisé → le serveur fait autorité', async () => {
    server.use(
      ...redeemHandlers({
        byCode: { GLOW99: { valid: true, valueCents: 5000, kind: 'promo' } as never },
      }),
    );
    useWizardStore.setState({ couponCode: 'GLOW99', creditCents: 10000, couponKind: 'promo' });
    render(<PromoCodeAutoApply />);
    await waitFor(() => expect(state().creditCents).toBe(5000));
  });

  it('non hydraté → attend l’hydratation avant d’appeler l’API', async () => {
    server.use(
      ...redeemHandlers({
        byCode: { GLOW99: { valid: true, valueCents: 10000, kind: 'promo' } as never },
      }),
    );
    useWizardStore.setState({ hydrated: false });
    search = 'code=GLOW99';
    render(<PromoCodeAutoApply />);
    await new Promise((r) => setTimeout(r, 50));
    expect(state().creditCents).toBe(0);
    useWizardStore.setState({ hydrated: true });
    await waitFor(() => expect(state().creditCents).toBe(10000));
  });
});
