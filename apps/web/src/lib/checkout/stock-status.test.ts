import { describe, expect, it } from 'vitest';

import { buildStockAlerts, toAdminStockView } from './stock-status';

const counter = (available: number, reserved: number, thresholdLow = 5) =>
  toAdminStockView({ variantId: 'pvar_1', sku: 'FEMI-KIT-100', available, reserved, thresholdLow });

describe('toAdminStockView', () => {
  it('calcule effectif et statut', () => {
    expect(counter(20, 3)).toMatchObject({ effective: 17, status: 'in_stock' });
    expect(counter(8, 3)).toMatchObject({ effective: 5, status: 'low_stock' });
    expect(counter(3, 3)).toMatchObject({ effective: 0, status: 'out_of_stock' });
  });

  it('garde un effectif négatif visible quand reserved dépasse available', () => {
    expect(counter(2, 5)).toMatchObject({ effective: -3, status: 'out_of_stock' });
  });
});

describe('buildStockAlerts', () => {
  const entry = (stock: ReturnType<typeof counter> | null) => ({
    sku: 'FEMI-KIT-100',
    label: 'Le Kit',
    stock,
  });

  it('ne signale rien au-dessus du seuil', () => {
    expect(buildStockAlerts([entry(counter(6, 0))])).toEqual([]);
  });

  it('signale le stock bas à seuil atteint', () => {
    expect(buildStockAlerts([entry(counter(5, 0))])).toEqual([
      expect.objectContaining({ level: 'low', effective: 5, thresholdLow: 5 }),
    ]);
  });

  it('classe effectif 0 ou négatif en commandes refusées, même avec un seuil à 0', () => {
    expect(buildStockAlerts([entry(counter(0, 0, 0))])[0]?.level).toBe('refused');
    expect(buildStockAlerts([entry(counter(1, 4))])[0]).toMatchObject({
      level: 'refused',
      effective: -3,
    });
  });

  it('classe une variante sans compteur en commandes refusées', () => {
    expect(buildStockAlerts([entry(null)])).toEqual([
      expect.objectContaining({ level: 'refused', effective: null, thresholdLow: null }),
    ]);
  });
});
