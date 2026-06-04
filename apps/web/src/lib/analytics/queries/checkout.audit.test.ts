/**
 * REPRODUCTION (vert AVANT-FIX) — onglet Checkout.
 *
 * Audit : docs/analytics-audit-2026-06-04/ — finding AN-04. `view_cart` jamais
 * émis (DB=0) ; l'event réel `address_completed` (15 en prod) n'est PAS mappé
 * par `classifyEvent` (qui attend `add_shipping_info`/`add_shipping`) → l'étape
 * add_shipping ne compte QUE les `add_shipping_info` (4 en prod).
 *
 * On prouve la lacune de mapping : add_shipping = (seuls add_shipping_info), les
 * `address_completed` ne sont PAS comptés ; view_cart = 0. `it.todo` = spec cible
 * après fix (address_completed → add_shipping, view_cart émis, submit explicite).
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';

import { getCheckoutData } from './checkout';
import { AUDIT_FROM, AUDIT_NOW, pushEvent, seedRealisticEvents } from './__fixtures__/realistic-events';
import type { AnalyticsFilters } from '../filters';

const NOW = AUDIT_NOW;
const FROM = AUDIT_FROM;

const FILTERS: AnalyticsFilters = {
  period: 'custom',
  device: 'all',
  traffic: 'all',
  from: FROM.toISOString(),
  to: NOW.toISOString(),
};

beforeEach(() => {
  resetMemoryStore();
});

function step(data: Awaited<ReturnType<typeof getCheckoutData>>, stage: string) {
  return data.steps.find((s) => s.stage === stage)!;
}

describe('Checkout audit — AN-04 (address_completed mappé add_shipping ; view_cart réel=0)', () => {
  it('A07-U001 [AN-04] add_shipping = 19 (address_completed + add_shipping_info)', async () => {
    // 15 sessions address_completed + 4 sessions add_shipping_info → 19 (fix).
    let id = 0;
    for (let i = 0; i < 15; i += 1) {
      pushEvent({ id: `ac${id++}`, sessionId: `ac_${i}`, eventName: 'begin_checkout', receivedAt: new Date(FROM.getTime() + 60_000) });
      pushEvent({ id: `ac${id++}`, sessionId: `ac_${i}`, eventName: 'address_completed', receivedAt: new Date(FROM.getTime() + 120_000), payload: { currency: 'MAD' } });
    }
    for (let i = 0; i < 4; i += 1) {
      pushEvent({ id: `as${id++}`, sessionId: `as_${i}`, eventName: 'begin_checkout', receivedAt: new Date(FROM.getTime() + 60_000) });
      pushEvent({ id: `as${id++}`, sessionId: `as_${i}`, eventName: 'add_shipping_info', receivedAt: new Date(FROM.getTime() + 120_000) });
    }
    const data = await getCheckoutData(FILTERS, NOW);
    expect(step(data, 'add_shipping').sessions).toBe(19);
  });

  it('A07-U002 [AN-04] address_completed seul est compté en add_shipping (=1)', async () => {
    pushEvent({ id: '1', sessionId: 'A', eventName: 'begin_checkout', receivedAt: new Date(FROM.getTime() + 60_000) });
    pushEvent({ id: '2', sessionId: 'A', eventName: 'address_completed', receivedAt: new Date(FROM.getTime() + 120_000), payload: { currency: 'MAD' } });
    const data = await getCheckoutData(FILTERS, NOW);
    expect(step(data, 'add_shipping').sessions).toBe(1);
  });

  it('A07-U003 [AN-04] view_cart toujours à 0 + première étape sessions=0', async () => {
    seedRealisticEvents();
    const data = await getCheckoutData(FILTERS, NOW);
    expect(data.totals.viewCart).toBe(0);
    expect(step(data, 'view_cart').sessions).toBe(0);
  });

  it('A07-U004 [AN-04] progression begin_checkout = null car view_cart=0 (prev=0)', async () => {
    seedRealisticEvents();
    const data = await getCheckoutData(FILTERS, NOW);
    // progressionFromPrevious(begin_checkout) = view_cart>0 ? bc/vc : null → null.
    expect(step(data, 'begin_checkout').progressionFromPrevious).toBeNull();
  });

  it('A07-U005 [AN-04] submit recopie purchase faute d’event submit dédié', async () => {
    // Aucun checkout_submit émis : `submit` est posé implicitement à l'arrivée
    // du purchase → submit.sessions === purchase.sessions.
    seedRealisticEvents();
    const data = await getCheckoutData(FILTERS, NOW);
    expect(step(data, 'submit').sessions).toBe(step(data, 'purchase').sessions);
  });

  it('A07-U006 [AN-04] checkout_submit non émis → submit propre = 0', async () => {
    pushEvent({ id: '1', sessionId: 'A', eventName: 'begin_checkout', receivedAt: new Date(FROM.getTime() + 60_000) });
    const data = await getCheckoutData(FILTERS, NOW);
    expect(step(data, 'submit').sessions).toBe(0);
  });

  it('A07-U011 [AN-04] events denied exclus du checkout (beginCheckout = 1)', async () => {
    pushEvent({ id: '1', sessionId: 'A', eventName: 'begin_checkout', receivedAt: new Date(FROM.getTime() + 60_000) });
    pushEvent({ id: '2', sessionId: 'B', eventName: 'begin_checkout', receivedAt: new Date(FROM.getTime() + 60_000), consentDenied: true });
    const data = await getCheckoutData(FILTERS, NOW);
    expect(data.totals.beginCheckout).toBe(1);
  });
});

describe('Checkout audit — reste à instrumenter côté émission (todo)', () => {
  // A07-U012 (address_completed→add_shipping) est désormais COUVERT par A07-U001.
  it.todo('A07-U014 [émission] view_cart à émettre pour remonter la 1ère étape (reste 0 tant que non émis)');
  it.todo('A07-U015 [émission] submit distinct de purchase (checkout_submit explicite à émettre)');
});
