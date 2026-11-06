import { describe, expect, it } from 'vitest';

import {
  buildStockAlerts,
  computePublicStockStatus,
  estimateDaysLeft,
  toAdminStockView,
} from './stock-status';

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

describe('statut public et autonomie', () => {
  const counter = { available: 0, reserved: 0, thresholdLow: 5 };

  it('vente continuée à 0 : ni rupture ni urgence pour la cliente', () => {
    for (const available of [-12, 0, 3, 500]) {
      expect(computePublicStockStatus({ ...counter, available, sellWhenOut: true })).toBe('in_stock');
    }
  });

  it('blocage actif : la rupture reste affichée', () => {
    expect(computePublicStockStatus({ ...counter, sellWhenOut: false })).toBe('out_of_stock');
  });

  it('estime les jours restants au rythme de la semaine', () => {
    expect(estimateDaysLeft(500, 875)).toBe(4);
    expect(estimateDaysLeft(-3, 875)).toBe(0);
    expect(estimateDaysLeft(500, 0)).toBeNull();
    expect(estimateDaysLeft(500, null)).toBeNull();
  });

  it('alerte « épuisé » sans parler de refus quand la vente continue', () => {
    const stock = toAdminStockView({ ...counter, variantId: 'v', sku: 'S', available: -2, sellWhenOut: true });
    const [alert] = buildStockAlerts([{ sku: 'S', label: 'L', stock }]);
    expect(alert).toMatchObject({ level: 'oversold', effective: -2 });
  });

  it('alerte tôt quand il reste moins de 7 jours, même au-dessus du seuil', () => {
    const stock = toAdminStockView(
      { ...counter, variantId: 'v', sku: 'S', available: 500, sellWhenOut: true },
      { soldLast7Days: 875 },
    );
    const [alert] = buildStockAlerts([{ sku: 'S', label: 'L', stock }]);
    expect(alert).toMatchObject({ level: 'low', daysLeft: 4 });
  });
});
