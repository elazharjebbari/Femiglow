/**
 * Lot L5 — `resolveSuggestedLocale` : précédence + éligibilité nudge.
 */
import { describe, expect, it } from 'vitest';

import { resolveSuggestedLocale } from './suggested-locale';

describe('resolveSuggestedLocale', () => {
  it('cookie explicite prime sur Accept-Language', () => {
    const r = resolveSuggestedLocale({
      servedLocale: 'fr',
      cookieLocale: 'en',
      acceptLanguage: 'ar;q=0.9',
    });
    expect(r.suggested).toBe('en');
  });

  it('Accept-Language utilisé si pas de cookie (suggère ar sur page fr)', () => {
    const r = resolveSuggestedLocale({
      servedLocale: 'fr',
      acceptLanguage: 'ar-MA,ar;q=0.9,fr;q=0.3',
    });
    expect(r.suggested).toBe('ar');
    expect(r.differsFromServed).toBe(true);
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('suggestion = servie → differsFromServed false (pas de nudge)', () => {
    const r = resolveSuggestedLocale({
      servedLocale: 'ar',
      acceptLanguage: 'ar;q=0.9',
    });
    expect(r.suggested).toBe('ar');
    expect(r.differsFromServed).toBe(false);
  });

  it('aucun signal → langue servie, confiance 0', () => {
    const r = resolveSuggestedLocale({ servedLocale: 'fr' });
    expect(r).toMatchObject({
      suggested: 'fr',
      served: 'fr',
      confidence: 0,
      differsFromServed: false,
    });
  });

  it('langue de la créa (adLocale) prise en compte', () => {
    const r = resolveSuggestedLocale({ servedLocale: 'fr', adLocale: 'en' });
    expect(r.suggested).toBe('en');
    expect(r.differsFromServed).toBe(true);
  });
});
