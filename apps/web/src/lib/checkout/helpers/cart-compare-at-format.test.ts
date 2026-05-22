import { describe, expect, it } from 'vitest';

import { formatCartCompareAt } from './cart-compare-at-format';
import type { CartSnapshot } from '@/lib/checkout/schemas/common';

const baseCart: CartSnapshot = {
  items: [
    {
      sku: 'kit-femiglow',
      name: 'Pack FemiGlow',
      variantId: 'pvar_0c01jxc1yn4kjp3b',
      unitPriceCents: 19900,
      quantity: 1,
    },
  ],
  totalCents: 19900,
  currency: 'MAD',
};

describe('formatCartCompareAt', () => {
  it('retourne la string formatée quand compareAt > total (MAD)', () => {
    const cart: CartSnapshot = {
      ...baseCart,
      compareAtTotalCents: 28900,
    };
    expect(formatCartCompareAt(cart)).toBe('289 MAD');
  });

  it('retourne la string formatée avec devise EUR', () => {
    const cart: CartSnapshot = {
      ...baseCart,
      currency: 'EUR',
      compareAtTotalCents: 28900,
    };
    expect(formatCartCompareAt(cart)).toBe('289 EUR');
  });

  it('retourne undefined si compareAtTotalCents est undefined (pas de promo)', () => {
    expect(formatCartCompareAt(baseCart)).toBeUndefined();
  });

  it('retourne undefined si compareAt <= total (cohérence : pas de barré sans réduction)', () => {
    const cart: CartSnapshot = {
      ...baseCart,
      compareAtTotalCents: 19900,
    };
    expect(formatCartCompareAt(cart)).toBeUndefined();
  });

  it('retourne undefined si compareAt strictement inférieur au total', () => {
    const cart: CartSnapshot = {
      ...baseCart,
      compareAtTotalCents: 10000,
    };
    expect(formatCartCompareAt(cart)).toBeUndefined();
  });

  it('retourne undefined si cart est null', () => {
    expect(formatCartCompareAt(null)).toBeUndefined();
  });

  it('retourne undefined si cart est undefined', () => {
    expect(formatCartCompareAt(undefined)).toBeUndefined();
  });

  it('arrondit correctement les centimes (pas de décimales affichées)', () => {
    const cart: CartSnapshot = {
      ...baseCart,
      compareAtTotalCents: 38950, // 389,50 MAD
    };
    expect(formatCartCompareAt(cart)).toBe('390 MAD'); // toFixed(0) arrondit
  });

  it('cas concret DB FemiGlow : 28900 vs 19900 → "289 MAD"', () => {
    const cart: CartSnapshot = {
      items: [
        {
          sku: 'FEMI-KIT-100',
          name: 'Pack FemiGlow',
          variantId: 'pvar_0c01jxc1yn4kjp3b',
          unitPriceCents: 19900,
          compareAtPriceCents: 28900,
          quantity: 1,
        },
      ],
      totalCents: 19900,
      compareAtTotalCents: 28900,
      currency: 'MAD',
    };
    expect(formatCartCompareAt(cart)).toBe('289 MAD');
  });

  it('cas mock seed : 39000 vs 19900 → "390 MAD"', () => {
    const cart: CartSnapshot = {
      items: [
        {
          sku: 'FEMI-KIT-100',
          name: 'Pack FemiGlow',
          variantId: 'pvar_0c01jxc1yn4kjp3b',
          unitPriceCents: 19900,
          compareAtPriceCents: 39000,
          quantity: 1,
        },
      ],
      totalCents: 19900,
      compareAtTotalCents: 39000,
      currency: 'MAD',
    };
    expect(formatCartCompareAt(cart)).toBe('390 MAD');
  });
});
