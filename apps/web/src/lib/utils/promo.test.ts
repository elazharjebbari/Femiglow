import { describe, it, expect } from 'vitest';
import { computePromo, formatPromoSavings } from './promo';
import { formatPrice } from './format-price';

describe('computePromo', () => {
  it('promo non fournie → inactive, prix effectif = prix barré', () => {
    const r = computePromo(32000, null);
    expect(r.active).toBe(false);
    expect(r.effectivePriceCents).toBe(32000);
    expect(r.savingsCents).toBe(0);
    expect(r.savingsPct).toBe(0);
  });

  it('promo undefined → inactive', () => {
    const r = computePromo(32000, undefined);
    expect(r.active).toBe(false);
  });

  it('promo >= prix → inactive (silencieux, pas d’erreur)', () => {
    expect(computePromo(32000, 32000).active).toBe(false);
    expect(computePromo(32000, 40000).active).toBe(false);
  });

  it('promo négative ou nulle → inactive', () => {
    expect(computePromo(32000, 0).active).toBe(false);
    expect(computePromo(32000, -100).active).toBe(false);
  });

  it('promo valide → active, savings calculés', () => {
    const r = computePromo(40000, 32000);
    expect(r.active).toBe(true);
    expect(r.effectivePriceCents).toBe(32000);
    expect(r.savingsCents).toBe(8000);
    // 8000 / 40000 = 20 %
    expect(r.savingsPct).toBe(20);
  });

  it('framing = "amount" pour MAD ~ panier > 100 majeur', () => {
    // 32000 cents = 320 MAD ; remise 8000 cents = 80 MAD → 20 %
    // 80 (montant) > 20 (percent) → framing = amount
    const r = computePromo(40000, 32000);
    expect(r.framing).toBe('amount');
  });

  it('framing = "percent" pour panier modeste', () => {
    // 800 cents = 8 unités majeures ; remise 200 cents = 2 unités majeures → 25 %
    // 2 (montant) < 25 (percent) → framing = percent
    const r = computePromo(800, 600);
    expect(r.framing).toBe('percent');
  });

  it('arrondit le pourcentage à l’entier', () => {
    // 100 cents → 67 cents = 33 % de remise
    const r = computePromo(100, 67);
    expect(r.savingsPct).toBe(33);
  });

  it('survit aux entrées non-finies (NaN, ∞)', () => {
    const r = computePromo(NaN, 100);
    expect(r.active).toBe(false);
    expect(r.savingsCents).toBe(0);
  });
});

describe('formatPromoSavings', () => {
  it('retourne null quand promo inactive', () => {
    const r = computePromo(32000, null);
    expect(formatPromoSavings(r, 'MAD', formatPrice)).toBeNull();
  });

  it('framing amount → "Économisez X DEVISE"', () => {
    const r = computePromo(40000, 32000);
    const label = formatPromoSavings(r, 'MAD', formatPrice);
    expect(label).toMatch(/Économisez\s+/);
    expect(label).toMatch(/MAD/);
  });

  it('framing percent → "Économisez N %"', () => {
    const r = computePromo(800, 600);
    const label = formatPromoSavings(r, 'EUR', formatPrice);
    expect(label).toBe('Économisez 25 %');
  });
});
