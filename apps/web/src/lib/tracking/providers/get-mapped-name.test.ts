import { describe, expect, it } from 'vitest';
import { getMappedName, isMetaCustomEvent } from './get-mapped-name';
import type { DispatchContext } from './types';

function ctxBase(overrides: Partial<DispatchContext> = {}): DispatchContext {
  return {
    eventName: 'purchase',
    eventId: 'evt_test',
    receivedAt: new Date(),
    pageRoute: '/',
    pageUrl: 'http://localhost:8011/',
    anonymousId: 'anon',
    sessionId: 'sess',
    consent: {
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      functional_storage: 'granted',
    },
    uaHash: 'ua',
    ipAnonymized: '0.0.0.0',
    device: 'desktop',
    locale: 'fr-MA',
    params: {},
    ...overrides,
  };
}

describe('getMappedName', () => {
  it('path V1.1+ : retourne resolvedMappings[kind].mappedName si présent', () => {
    const ctx = ctxBase({
      resolvedMappings: {
        meta: { mappedName: 'PremiumPurchase', isCustom: true, notes: null },
      },
    });
    expect(getMappedName(ctx, 'meta')).toBe('PremiumPurchase');
  });

  it('path V1.1+ : retourne null si provider absent de resolvedMappings (admin a désactivé)', () => {
    const ctx = ctxBase({
      resolvedMappings: {
        meta: { mappedName: 'Purchase', isCustom: false, notes: null },
        // google_ga4 absent → ctx.resolvedMappings.google_ga4 === undefined
      },
    });
    expect(getMappedName(ctx, 'google_ga4')).toBeNull();
  });

  it('path V1.1+ : retourne null même si admin a coupé tous les providers (resolvedMappings={})', () => {
    const ctx = ctxBase({ resolvedMappings: {} });
    expect(getMappedName(ctx, 'meta')).toBeNull();
    expect(getMappedName(ctx, 'tiktok')).toBeNull();
  });

  it('path legacy : si resolvedMappings undefined, fallback mapEventName du code', () => {
    const ctx = ctxBase({ eventName: 'purchase', resolvedMappings: undefined });
    expect(getMappedName(ctx, 'meta')).toBe('Purchase');
    expect(getMappedName(ctx, 'google_ga4')).toBe('purchase');
  });

  it('path legacy : event inconnu du catalog code → null', () => {
    const ctx = ctxBase({ eventName: 'unknown_event_xyz', resolvedMappings: undefined });
    expect(getMappedName(ctx, 'meta')).toBeNull();
  });

  it('respecte la priorité : si resolvedMappings défini, on N\'utilise PAS le legacy', () => {
    // Cas critique : admin a explicitement décidé "rien dispatcher Meta pour purchase"
    // → on ne doit JAMAIS retomber sur le code legacy qui dirait 'Purchase'
    const ctx = ctxBase({
      eventName: 'purchase',
      resolvedMappings: {
        // meta intentionnellement absent
        google_ga4: { mappedName: 'purchase', isCustom: false, notes: null },
      },
    });
    expect(getMappedName(ctx, 'meta')).toBeNull();
    expect(getMappedName(ctx, 'google_ga4')).toBe('purchase');
  });
});

describe('isMetaCustomEvent', () => {
  it('retourne false par défaut (pas de resolvedMappings)', () => {
    expect(isMetaCustomEvent(ctxBase())).toBe(false);
  });

  it('retourne true si admin a flag isCustom=true', () => {
    const ctx = ctxBase({
      resolvedMappings: {
        meta: { mappedName: 'checkout_intent', isCustom: true, notes: null },
      },
    });
    expect(isMetaCustomEvent(ctx)).toBe(true);
  });

  it('retourne false si Meta présent avec isCustom=false', () => {
    const ctx = ctxBase({
      resolvedMappings: {
        meta: { mappedName: 'Purchase', isCustom: false, notes: null },
      },
    });
    expect(isMetaCustomEvent(ctx)).toBe(false);
  });

  it('retourne false si Meta absent de resolvedMappings', () => {
    const ctx = ctxBase({
      resolvedMappings: {
        google_ga4: { mappedName: 'purchase', isCustom: false, notes: null },
      },
    });
    expect(isMetaCustomEvent(ctx)).toBe(false);
  });
});
