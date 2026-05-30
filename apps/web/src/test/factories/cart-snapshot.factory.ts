/**
 * Factory pour générer des `CartSnapshot` typés en tests checkout.
 *
 * Référence : `docs/test-strategy-2026-05/03-data-strategy.md`
 */
import type {
  CartSnapshot,
  CartItemSnapshot,
} from '@/lib/checkout/schemas/common';

import { defineFactory, createCounter, testId } from './base';

const counter = createCounter();

export const cartItemFactory = defineFactory<CartItemSnapshot>(() => ({
  sku: `SKU_${counter.next()}`,
  name: 'Pack FemiGlow',
  quantity: 1,
  unitPriceCents: 19900,
  variantId: testId('pvar'),
}));

export const cartSnapshotFactory = {
  ...defineFactory<CartSnapshot>(() => ({
    items: [cartItemFactory.build()],
    totalCents: 19900,
    currency: 'MAD',
  })),

  /** Trait — cart avec promo active (compareAt > total). */
  withPromo(overrides: Partial<CartSnapshot> = {}): CartSnapshot {
    const item = cartItemFactory.build({
      unitPriceCents: 19900,
      compareAtPriceCents: 28900,
    });
    return this.build({
      items: [item],
      totalCents: 19900,
      compareAtTotalCents: 28900,
      currency: 'MAD',
      ...overrides,
    });
  },

  /** Trait — multi-item cart (3 items). */
  multiItem(overrides: Partial<CartSnapshot> = {}): CartSnapshot {
    const items = cartItemFactory.buildMany(3);
    const totalCents = items.reduce(
      (acc, i) => acc + i.unitPriceCents * i.quantity,
      0,
    );
    return this.build({ items, totalCents, ...overrides });
  },

  /** Trait — devise EUR. */
  inEur(overrides: Partial<CartSnapshot> = {}): CartSnapshot {
    return this.build({ currency: 'EUR', ...overrides });
  },

  __resetCounter(): void {
    counter.reset();
  },
};
