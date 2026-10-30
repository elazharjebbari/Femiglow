import { describe, expect, it } from 'vitest';

import { decideRememberedPromo, PROMO_MEMORY_MS } from './promo-memory';

const NOW = Date.UTC(2026, 9, 30, 18, 0, 0);

describe('decideRememberedPromo', () => {
  it('garde un code promo vu il y a moins de 48 h', () => {
    expect(
      decideRememberedPromo({
        couponCode: 'GLOW99',
        couponKind: 'promo',
        couponUrlSeenAt: NOW - PROMO_MEMORY_MS + 1000,
        now: NOW,
      }),
    ).toBe('keep');
  });

  it('expire un code promo vu il y a plus de 48 h', () => {
    expect(
      decideRememberedPromo({
        couponCode: 'GLOW99',
        couponKind: 'promo',
        couponUrlSeenAt: NOW - PROMO_MEMORY_MS - 1,
        now: NOW,
      }),
    ).toBe('expire');
  });

  it('ouvre la fenêtre pour un code promo mémorisé avant le correctif (horodatage absent)', () => {
    expect(
      decideRememberedPromo({ couponCode: 'GLOW99', couponKind: 'promo', couponUrlSeenAt: null, now: NOW }),
    ).toBe('start-window');
  });

  it('ne touche jamais un crédit de fidélité ni un store vide', () => {
    expect(
      decideRememberedPromo({
        couponCode: 'FG-SAUGE-7212',
        couponKind: 'credit',
        couponUrlSeenAt: NOW - 10 * PROMO_MEMORY_MS,
        now: NOW,
      }),
    ).toBe('keep');
    expect(
      decideRememberedPromo({ couponCode: null, couponKind: null, couponUrlSeenAt: null, now: NOW }),
    ).toBe('keep');
  });
});
