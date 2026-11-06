import { beforeEach, describe, expect, it, vi } from 'vitest';

const listByVariantIds = vi.fn();
const listPublishedVariants = vi.fn();
vi.mock('@/lib/checkout/repos/stock-repo', () => ({
  stockRepo: {
    listByVariantIds: (...a: unknown[]) => listByVariantIds(...a),
    listPublishedVariants: (...a: unknown[]) => listPublishedVariants(...a),
  },
}));

import { loadPublishedStockAlerts, loadVariantStock } from './admin-stock';

const snapshot = {
  variantId: 'pvar_1',
  sku: 'FEMI-KIT-100',
  available: 0,
  reserved: 0,
  thresholdLow: 5,
};

beforeEach(() => {
  listByVariantIds.mockReset();
  listPublishedVariants.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('loadVariantStock', () => {
  it('indexe les compteurs par variante', async () => {
    listByVariantIds.mockResolvedValue([snapshot]);
    const read = await loadVariantStock(['pvar_1', 'pvar_sans_compteur']);
    expect(read.readable).toBe(true);
    expect(read.byVariantId.pvar_1).toMatchObject({ effective: 0, status: 'out_of_stock' });
    expect(read.byVariantId.pvar_sans_compteur).toBeUndefined();
  });

  it('remonte readable=false si la lecture échoue', async () => {
    listByVariantIds.mockRejectedValue(new Error('db down'));
    await expect(loadVariantStock(['pvar_1'])).resolves.toEqual({
      byVariantId: {},
      readable: false,
    });
  });
});

describe('loadPublishedStockAlerts', () => {
  const row = {
    productSlug: 'le-kit',
    productTitle: 'Le Kit',
    sku: 'FEMI-KIT-100',
    label: 'Pack',
  };

  it('alerte sur un compteur à 0 et sur une variante sans compteur', async () => {
    listPublishedVariants.mockResolvedValue([
      { ...row, stock: snapshot },
      { ...row, sku: 'FEMI-KIT-200', stock: null },
      { ...row, sku: 'FEMI-KIT-300', stock: { ...snapshot, available: 50 } },
    ]);
    const read = await loadPublishedStockAlerts();
    expect(read.readable).toBe(true);
    expect(read.alerts.map((a) => [a.sku, a.level, a.productSlug])).toEqual([
      ['FEMI-KIT-100', 'refused', 'le-kit'],
      ['FEMI-KIT-200', 'refused', 'le-kit'],
    ]);
  });

  it('remonte readable=false si la lecture échoue', async () => {
    listPublishedVariants.mockRejectedValue(new Error('db down'));
    await expect(loadPublishedStockAlerts()).resolves.toEqual({ alerts: [], readable: false });
  });
});
