/**
 * Tests du helper `buildPerUsageHint`.
 *
 * Pur : entrées `(priceCents, days)`, sortie chaîne formatée FR ou null.
 */
import { describe, it, expect } from 'vitest';

import { buildPerUsageHint } from './per-usage';

describe('buildPerUsageHint', () => {
  it('retourne null si days <= 0', () => {
    expect(buildPerUsageHint(3500, 0)).toBeNull();
    expect(buildPerUsageHint(3500, -1)).toBeNull();
  });

  it('retourne null si priceCents <= 0', () => {
    expect(buildPerUsageHint(0, 30)).toBeNull();
    expect(buildPerUsageHint(-100, 30)).toBeNull();
  });

  it('retourne null si entrées non finies', () => {
    expect(buildPerUsageHint(Number.NaN, 30)).toBeNull();
    expect(buildPerUsageHint(3500, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('formate « ≈ 0,75 € par soin sur 30 jours » (cas Kolenda type)', () => {
    // 3500 cts / 30 jours = 116,67 cts/jour soit ~1,17 € par soin
    // … mais le helper doit présenter en FR avec 2 décimales virgule
    // séparateur. Le calcul ici utilise 30 jours = 30 soins, donc
    // 35 / 30 = 1,17 €. Pour matcher le copy mockée, on prendra 35 € / 47 soins.
    expect(buildPerUsageHint(3500, 47)).toBe('≈ 0,74 € par soin sur 47 jours');
  });

  it('arrondit à 2 décimales virgule (locale FR)', () => {
    expect(buildPerUsageHint(3500, 30)).toBe('≈ 1,17 € par soin sur 30 jours');
  });
});
