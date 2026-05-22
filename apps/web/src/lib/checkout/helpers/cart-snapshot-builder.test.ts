import { describe, expect, it } from 'vitest';

import {
  isPromoActive,
  projectCartSnapshotFromVariant,
} from './cart-snapshot-builder';

describe('isPromoActive', () => {
  it('true quand promoPriceCents < priceCents et > 0', () => {
    expect(
      isPromoActive({
        sku: 'X',
        priceCents: 28900,
        promoPriceCents: 19900,
        currency: 'MAD',
      }),
    ).toBe(true);
  });

  it('false quand promoPriceCents === priceCents', () => {
    expect(
      isPromoActive({
        sku: 'X',
        priceCents: 19900,
        promoPriceCents: 19900,
        currency: 'MAD',
      }),
    ).toBe(false);
  });

  it('false quand promoPriceCents > priceCents (incohérence data)', () => {
    expect(
      isPromoActive({
        sku: 'X',
        priceCents: 19900,
        promoPriceCents: 25000,
        currency: 'MAD',
      }),
    ).toBe(false);
  });

  it('false quand promoPriceCents est null', () => {
    expect(
      isPromoActive({
        sku: 'X',
        priceCents: 28900,
        promoPriceCents: null,
        currency: 'MAD',
      }),
    ).toBe(false);
  });

  it('false quand promoPriceCents === 0 (n est pas une promo réelle)', () => {
    expect(
      isPromoActive({
        sku: 'X',
        priceCents: 28900,
        promoPriceCents: 0,
        currency: 'MAD',
      }),
    ).toBe(false);
  });
});

describe('projectCartSnapshotFromVariant', () => {
  it('promo active : unitPrice = promo, compareAt = price régulier', () => {
    const cart = projectCartSnapshotFromVariant(
      {
        sku: 'FEMI-KIT-100',
        priceCents: 28900,
        promoPriceCents: 19900,
        currency: 'MAD',
        variantId: 'pvar_xyz',
      },
      { productName: 'Pack FemiGlow' },
    );
    expect(cart.items[0]!.unitPriceCents).toBe(19900);
    expect(cart.items[0]!.compareAtPriceCents).toBe(28900);
    expect(cart.totalCents).toBe(19900);
    expect(cart.compareAtTotalCents).toBe(28900);
    expect(cart.currency).toBe('MAD');
  });

  it('pas de promo : compareAt undefined (pas de strike-through)', () => {
    const cart = projectCartSnapshotFromVariant(
      {
        sku: 'FEMI-KIT-100',
        priceCents: 19900,
        promoPriceCents: null,
        currency: 'MAD',
      },
      { productName: 'Pack FemiGlow' },
    );
    expect(cart.items[0]!.unitPriceCents).toBe(19900);
    expect(cart.items[0]!.compareAtPriceCents).toBeUndefined();
    expect(cart.totalCents).toBe(19900);
    expect(cart.compareAtTotalCents).toBeUndefined();
  });

  it('promo égale prix régulier : compareAt undefined', () => {
    const cart = projectCartSnapshotFromVariant(
      {
        sku: 'X',
        priceCents: 19900,
        promoPriceCents: 19900,
        currency: 'MAD',
      },
      { productName: 'Pack FemiGlow' },
    );
    expect(cart.compareAtTotalCents).toBeUndefined();
  });

  it('quantity > 1 : total et compareAt multipliés correctement', () => {
    const cart = projectCartSnapshotFromVariant(
      {
        sku: 'X',
        priceCents: 28900,
        promoPriceCents: 19900,
        currency: 'MAD',
      },
      { productName: 'Pack FemiGlow', quantity: 3 },
    );
    expect(cart.items[0]!.quantity).toBe(3);
    expect(cart.totalCents).toBe(19900 * 3);
    expect(cart.compareAtTotalCents).toBe(28900 * 3);
  });

  it('devise EUR : compareAt projeté en EUR', () => {
    const cart = projectCartSnapshotFromVariant(
      {
        sku: 'X',
        priceCents: 28900,
        promoPriceCents: 19900,
        currency: 'EUR',
      },
      { productName: 'Pack FemiGlow' },
    );
    expect(cart.currency).toBe('EUR');
    expect(cart.compareAtTotalCents).toBe(28900);
  });

  it('variantId propagé dans l item', () => {
    const cart = projectCartSnapshotFromVariant(
      {
        sku: 'X',
        priceCents: 28900,
        promoPriceCents: 19900,
        currency: 'MAD',
        variantId: 'pvar_abc123',
      },
      { productName: 'Pack' },
    );
    expect(cart.items[0]!.variantId).toBe('pvar_abc123');
  });

  it('productName custom propagé', () => {
    const cart = projectCartSnapshotFromVariant(
      {
        sku: 'X',
        priceCents: 28900,
        promoPriceCents: 19900,
        currency: 'MAD',
      },
      { productName: 'Coffret Édition Limitée' },
    );
    expect(cart.items[0]!.name).toBe('Coffret Édition Limitée');
  });

  it('cas concret FemiGlow attendu : DB 28900/19900 → 289 barré / 199 affiché', () => {
    const cart = projectCartSnapshotFromVariant(
      {
        sku: 'FEMI-KIT-100',
        priceCents: 28900,
        promoPriceCents: 19900,
        currency: 'MAD',
        variantId: 'pvar_0c01jxc1yn4kjp3b',
      },
      { productName: 'Pack FemiGlow' },
    );
    expect(cart.totalCents).toBe(19900);
    expect(cart.compareAtTotalCents).toBe(28900);
  });

  it('cas mock seed : 39000/19900 → 390 barré / 199 affiché', () => {
    const cart = projectCartSnapshotFromVariant(
      {
        sku: 'FEMI-KIT-100',
        priceCents: 39000,
        promoPriceCents: 19900,
        currency: 'MAD',
      },
      { productName: 'Pack FemiGlow' },
    );
    expect(cart.totalCents).toBe(19900);
    expect(cart.compareAtTotalCents).toBe(39000);
  });
});
