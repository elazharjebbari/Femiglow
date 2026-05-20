/**
 * Tests du helper `computePackSavings`.
 *
 * Le helper est pur : entrée `(priceFinalCents, priceCompareAtCents)`,
 * sortie `{ eur, pct } | null`. Aucune dépendance, aucune I/O.
 */
import { describe, it, expect } from 'vitest';

import { computePackSavings, formatSavingsLabel } from './savings';

describe('computePackSavings', () => {
  it('retourne null si pas de prix barré', () => {
    expect(computePackSavings(3500, null)).toBeNull();
    expect(computePackSavings(3500, undefined)).toBeNull();
  });

  it('retourne null si prix barré <= prix final (cohérence)', () => {
    expect(computePackSavings(3500, 3500)).toBeNull();
    expect(computePackSavings(3500, 3000)).toBeNull();
  });

  it('retourne null si prix final ou barré non finis / négatifs', () => {
    expect(computePackSavings(-100, 4900)).toBeNull();
    expect(computePackSavings(3500, Number.NaN)).toBeNull();
    expect(computePackSavings(Number.POSITIVE_INFINITY, 4900)).toBeNull();
  });

  it('calcule l’économie en EUR (centimes → majeurs)', () => {
    const r = computePackSavings(3500, 4900);
    expect(r).not.toBeNull();
    expect(r!.eur).toBe(14);
  });

  it('calcule l’économie en pourcentage entier arrondi', () => {
    const r = computePackSavings(3500, 4900);
    expect(r).not.toBeNull();
    // 14/49 = 0.2857 → 29 %
    expect(r!.pct).toBe(29);
  });

  it('arrondi entier sur des valeurs piégeuses', () => {
    // 4900-3550 = 1350 cts → 13.5 € arrondi à 14 €
    const r = computePackSavings(3550, 4900);
    expect(r).not.toBeNull();
    expect(r!.eur).toBe(14);
  });

  it('cas extrême — économie de 100 %', () => {
    const r = computePackSavings(0, 4900);
    expect(r).not.toBeNull();
    expect(r!.eur).toBe(49);
    expect(r!.pct).toBe(100);
  });

  it('pct >= 1 même pour micro-économie (arrondi supérieur si tronquerait à 0)', () => {
    // 4900 - 4895 = 5 cts → 0.10 % → arrondi 0 % → on remonte à 1
    const r = computePackSavings(4895, 4900);
    expect(r).not.toBeNull();
    expect(r!.pct).toBeGreaterThanOrEqual(1);
  });
});

describe('formatSavingsLabel', () => {
  it('formate « Vous économisez 14 € · 29 % »', () => {
    expect(formatSavingsLabel({ eur: 14, pct: 29 })).toBe(
      'Vous économisez 14 € · 29 %',
    );
  });
});
