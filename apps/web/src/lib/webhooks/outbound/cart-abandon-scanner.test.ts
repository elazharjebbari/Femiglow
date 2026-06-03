/**
 * Tests du prédicat d'éligibilité cart-abandon (`isCartAbandonEligible`).
 *
 * Règle clé : un `cart.abandoned` EXIGE un panier. Les leads conversationnels
 * du chat (`source='chat_widget'`, sans `cart_snapshot`) doivent être exclus —
 * ils ne reçoivent QUE leur webhook `lead.created`. Cf. fix double-envoi.
 */
import { describe, expect, it } from 'vitest';

import {
  isCartAbandonEligible,
  type CartAbandonCandidate,
  type CartAbandonEligibilityOpts,
} from './cart-abandon-scanner';

const NOW = new Date('2026-06-03T12:00:00Z').getTime();
const OPTS: CartAbandonEligibilityOpts = {
  now: NOW,
  idleMs: 30 * 60 * 1000, // 30 min
  maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 j
};

const CART = {
  items: [{ sku: 'WTC-42', name: 'Pack', quantity: 1, unitPriceCents: 19900 }],
  totalCents: 19900,
  currency: 'MAD',
};

function lead(over: Partial<CartAbandonCandidate> = {}): CartAbandonCandidate {
  return {
    cartSnapshot: CART,
    phoneE164: '+212661234567',
    phoneRaw: '0661234567',
    purchasedAt: null,
    abandonWebhookAt: null,
    // 1h avant NOW → passé le seuil d'inaction (30 min), sous le TTL (7 j).
    createdAt: new Date(NOW - 60 * 60 * 1000),
    ...over,
  } as CartAbandonCandidate;
}

describe('isCartAbandonEligible', () => {
  it('éligible : lead wizard avec panier, > seuil idle, < TTL', () => {
    expect(isCartAbandonEligible(lead(), OPTS)).toBe(true);
  });

  it('EXCLU : pas de panier (cas chat_widget — rappel/manuel/inline)', () => {
    expect(isCartAbandonEligible(lead({ cartSnapshot: null }), OPTS)).toBe(false);
  });

  it('exclu : déjà converti (purchasedAt)', () => {
    expect(isCartAbandonEligible(lead({ purchasedAt: new Date(NOW) }), OPTS)).toBe(false);
  });

  it('exclu : déjà notifié (abandonWebhookAt — anti-doublon)', () => {
    expect(isCartAbandonEligible(lead({ abandonWebhookAt: new Date(NOW) }), OPTS)).toBe(false);
  });

  it('exclu : pas de téléphone', () => {
    expect(isCartAbandonEligible(lead({ phoneE164: '', phoneRaw: '' }), OPTS)).toBe(false);
  });

  it('exclu : trop récent (seuil d’inaction non atteint)', () => {
    expect(
      isCartAbandonEligible(lead({ createdAt: new Date(NOW - 5 * 60 * 1000) }), OPTS),
    ).toBe(false);
  });

  it('exclu : trop vieux (au-delà du TTL anti-replay)', () => {
    expect(
      isCartAbandonEligible(lead({ createdAt: new Date(NOW - 8 * 24 * 60 * 60 * 1000) }), OPTS),
    ).toBe(false);
  });
});
