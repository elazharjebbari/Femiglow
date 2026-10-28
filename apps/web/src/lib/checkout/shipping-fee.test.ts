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
