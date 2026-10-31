import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/checkout/shipping-config', () => ({
  getShippingConfig: vi.fn(),
}));
vi.mock('@/lib/db/queries/delivery-cities', () => ({
  searchDeliveryCities: vi.fn(),
}));

import { getShippingConfig } from '@/lib/checkout/shipping-config';
import { searchDeliveryCities } from '@/lib/db/queries/delivery-cities';
import {
  DEFAULT_DELIVERY_PRICE_MAD,
  checkoutReferenceCents,
  checkoutTotalCents,
  matchesCityExactly,
  shippingCentsFromPrice,
} from './shipping-fee';
import { resolveShippingCents } from './shipping-fee-server';

const casablanca = {
  nameFr: 'Casablanca',
  nameAr: 'الدار البيضاء',
  slug: 'casablanca',
  aliases: ['casa'],
  deliveryPriceMad: 19,
};
const casablancaAnfa = { ...casablanca, nameFr: 'Casablanca Anfa', slug: 'casablanca-anfa', aliases: [], deliveryPriceMad: 29 };

describe('shippingCentsFromPrice', () => {
  it('convertit le tarif de la ville en centimes', () => {
    expect(shippingCentsFromPrice(35, false)).toBe(3500);
  });
  it('ville inconnue → tarif par défaut (le plus haut)', () => {
    expect(shippingCentsFromPrice(null, false)).toBe(DEFAULT_DELIVERY_PRICE_MAD * 100);
  });
  it('flag freeShipping → 0', () => {
    expect(shippingCentsFromPrice(35, true)).toBe(0);
  });
});

describe('matchesCityExactly', () => {
  it('accepte nom FR, AR, slug et alias, sans casse', () => {
    expect(matchesCityExactly(casablanca, ' casablanca ')).toBe(true);
    expect(matchesCityExactly(casablanca, 'الدار البيضاء')).toBe(true);
    expect(matchesCityExactly(casablanca, 'CASA')).toBe(true);
    expect(matchesCityExactly(casablanca, 'casab')).toBe(false);
  });
});

describe('resolveShippingCents', () => {
  beforeEach(() => {
    vi.mocked(getShippingConfig).mockResolvedValue({ freeShipping: false });
  });

  it('prend le tarif de la ville qui correspond exactement, pas du 1er préfixe', async () => {
    vi.mocked(searchDeliveryCities).mockResolvedValue([casablancaAnfa, casablanca] as never);
    await expect(resolveShippingCents('Casablanca')).resolves.toBe(1900);
  });

  it('ville saisie en frappe libre non reconnue → tarif par défaut', async () => {
    vi.mocked(searchDeliveryCities).mockResolvedValue([casablancaAnfa] as never);
    await expect(resolveShippingCents('Casab')).resolves.toBe(DEFAULT_DELIVERY_PRICE_MAD * 100);
  });

  it('livraison offerte (flag admin) → 0 sans lookup', async () => {
    vi.mocked(getShippingConfig).mockResolvedValue({ freeShipping: true });
    vi.mocked(searchDeliveryCities).mockClear();
    await expect(resolveShippingCents('Rabat')).resolves.toBe(0);
    expect(searchDeliveryCities).not.toHaveBeenCalled();
  });
});

describe('checkoutTotalCents', () => {
  it.each([19, 29, 35, 39, 45])('panier 199 MAD, frais %i MAD', (mad) => {
    expect(
      checkoutTotalCents({
        cartTotalCents: 19900,
        creditCents: 0,
        shippingCents: shippingCentsFromPrice(mad, false),
      }),
    ).toBe(19900 + mad * 100);
  });

  it('ville hors catalogue : 45 MAD, comme le serveur', () => {
    expect(
      checkoutTotalCents({
        cartTotalCents: 9900,
        creditCents: 0,
        shippingCents: shippingCentsFromPrice(null, false),
      }),
    ).toBe(9900 + DEFAULT_DELIVERY_PRICE_MAD * 100);
  });

  it('livraison offerte : aucun frais', () => {
    expect(
      checkoutTotalCents({
        cartTotalCents: 19900,
        creditCents: 0,
        shippingCents: shippingCentsFromPrice(35, true),
      }),
    ).toBe(19900);
  });

  it('remise GLOW99 : déduite du produit, pas des frais', () => {
    expect(
      checkoutTotalCents({
        cartTotalCents: 19900,
        creditCents: 9000,
        shippingCents: shippingCentsFromPrice(35, false),
      }),
    ).toBe(10900 + 3500);
  });

  it('crédit supérieur au panier : plafonné, les frais restent dus', () => {
    expect(
      checkoutTotalCents({ cartTotalCents: 9900, creditCents: 50000, shippingCents: 3500 }),
    ).toBe(3500);
  });
});

describe('checkoutReferenceCents', () => {
  const base = { cartTotalCents: 19900, compareAtTotalCents: 28900, shippingCents: 3500 };

  it('avec un code : l’écart barré égale exactement la remise', () => {
    const reference = checkoutReferenceCents({ ...base, creditCents: 10000 });
    const total = checkoutTotalCents({
      cartTotalCents: 19900,
      creditCents: 10000,
      shippingCents: 3500,
    });
    expect(reference).toBe(23400);
    expect(reference! - total).toBe(10000);
  });

  it('sans code : prix de référence du produit, frais compris', () => {
    expect(checkoutReferenceCents({ ...base, creditCents: 0 })).toBe(32400);
  });

  it('sans code ni prix de référence : rien à barrer', () => {
    expect(
      checkoutReferenceCents({ cartTotalCents: 19900, creditCents: 0, shippingCents: 3500 }),
    ).toBeNull();
    expect(
      checkoutReferenceCents({
        cartTotalCents: 19900,
        compareAtTotalCents: 19900,
        creditCents: 0,
        shippingCents: 0,
      }),
    ).toBeNull();
  });
});
