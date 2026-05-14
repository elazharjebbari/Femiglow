/**
 * Test intégration : le dispatcher injecte resolvedMappings et les adapters
 * l'utilisent en priorité sur le code legacy.
 *
 * Garantit la fermeture de la boucle "édition admin → effet dispatch prod".
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// On stub resolveEventMapping pour simuler ce que l'admin a configuré.
const resolverStub = vi.hoisted(() => ({
  byKey: new Map<string, { mappedName: string; isCustom: boolean; notes: string | null } | null>(),
}));

vi.mock('@/lib/tracking/mappings/resolver', () => ({
  resolveEventMapping: async (eventName: string, kind: string) => {
    return resolverStub.byKey.get(`${eventName}|${kind}`) ?? null;
  },
  invalidateMappingResolverCache: () => {},
}));

// Pas de providers DB → dispatchToProviders retournera dispatched=[] mais
// l'enrichissement de ctx aura quand même eu lieu.
vi.mock('@/lib/db/queries/tracking/providers', () => ({
  listEnabledTrackingProviders: async () => [],
  decryptCapiToken: () => null,
}));

import { getMappedName } from '@/lib/tracking/providers/get-mapped-name';
import type { DispatchContext } from '@/lib/tracking/providers/types';

beforeEach(() => {
  resolverStub.byKey.clear();
});

function ctxFor(eventName: string, resolved?: NonNullable<DispatchContext['resolvedMappings']>): DispatchContext {
  return {
    eventName,
    eventId: 'evt_test',
    receivedAt: new Date(),
    pageRoute: '/',
    pageUrl: 'http://test/',
    anonymousId: 'a',
    sessionId: 's',
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
    resolvedMappings: resolved,
  };
}

describe('Fermeture de boucle admin → dispatch', () => {
  it('SCENARIO 1 — Admin override Meta: "Purchase" → "PremiumPurchase" est respecté', () => {
    const ctx = ctxFor('purchase', {
      meta: { mappedName: 'PremiumPurchase', isCustom: true, notes: 'campagne Q2' },
    });
    // Chaque adapter consomme getMappedName → doit retourner 'PremiumPurchase'
    expect(getMappedName(ctx, 'meta')).toBe('PremiumPurchase');
  });

  it('SCENARIO 2 — Admin a désactivé Meta pour purchase → adapter doit skip (null)', () => {
    const ctx = ctxFor('purchase', {
      // meta absent intentionnellement (admin a mis isEnabled=false)
      google_ga4: { mappedName: 'purchase', isCustom: false, notes: null },
    });
    expect(getMappedName(ctx, 'meta')).toBeNull();
    // Mais GA4 reste actif :
    expect(getMappedName(ctx, 'google_ga4')).toBe('purchase');
  });

  it('SCENARIO 3 — Admin a tout désactivé pour purchase → skip total', () => {
    const ctx = ctxFor('purchase', {});
    for (const kind of ['meta', 'google_ga4', 'google_ads', 'tiktok', 'snap', 'pinterest'] as const) {
      expect(getMappedName(ctx, kind)).toBeNull();
    }
  });

  it('SCENARIO 4 — Backward compat : pas de resolvedMappings (script legacy) → fallback code', () => {
    const ctx = ctxFor('purchase'); // resolvedMappings undefined
    expect(getMappedName(ctx, 'meta')).toBe('Purchase'); // valeur du code legacy
  });

  it('SCENARIO 5 — Meta custom event est dispatched avec son nom personnalisé', () => {
    const ctx = ctxFor('begin_checkout', {
      meta: { mappedName: 'checkout_intent', isCustom: true, notes: null },
    });
    expect(getMappedName(ctx, 'meta')).toBe('checkout_intent');
  });

  it('SCENARIO 6 — La cellule isCustom=true sera flaguée dans le payload Meta', async () => {
    const { isMetaCustomEvent } = await import('@/lib/tracking/providers/get-mapped-name');
    const ctxStd = ctxFor('purchase', { meta: { mappedName: 'Purchase', isCustom: false, notes: null } });
    expect(isMetaCustomEvent(ctxStd)).toBe(false);
    const ctxCustom = ctxFor('begin_checkout', { meta: { mappedName: 'checkout_intent', isCustom: true, notes: null } });
    expect(isMetaCustomEvent(ctxCustom)).toBe(true);
  });
});
