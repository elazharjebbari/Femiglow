/**
 * Tests d'intégration : `dispatchToProviders` × gate d'attribution.
 *
 * Vérifie qu'un visiteur attribué à un canal X ne déclenche le
 * dispatch QUE pour ce canal (+ GA4 toujours), ET pas pour les
 * autres pixels. Audience events fire partout.
 *
 * Mock les providers via memoryStore + upsertTrackingProvider
 * (pattern utilisé dans `tracking-providers-extra.test.ts`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { upsertTrackingProvider } from '@/lib/db/queries/tracking/providers';
import { dispatchToProviders } from './dispatcher';
import type { DispatchContext } from '@/lib/tracking/providers/types';
import { upsertAttribution } from '@/lib/tracking/attribution/repository';
import type { ChannelTouch } from '@/lib/tracking/attribution/types';

const GRANTED = {
  ad_storage: 'granted' as const,
  ad_user_data: 'granted' as const,
  ad_personalization: 'granted' as const,
  analytics_storage: 'granted' as const,
  functional_storage: 'granted' as const,
  security_storage: 'granted' as const,
};

function ctx(overrides: Partial<DispatchContext> = {}): DispatchContext {
  return {
    eventName: 'purchase',
    eventId: 'e_test_1',
    receivedAt: new Date('2026-05-15T12:00:00Z'),
    pageRoute: '/kit',
    pageUrl: 'https://femiglow-maroc.com/kit',
    anonymousId: 'v_test',
    sessionId: 's_test',
    consent: GRANTED,
    uaHash: 'uahash',
    ipAnonymized: '0.0.0.0',
    device: 'mobile',
    locale: 'fr-MA',
    params: { transaction_id: 'order_test_1', value: 199, currency: 'MAD' },
    ...overrides,
  };
}

function touch(overrides: Partial<ChannelTouch> = {}): ChannelTouch {
  return {
    channel: 'direct',
    is_paid: false,
    detected_at: '2026-05-15T11:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  resetMemoryStore();
  // Mock fetch global pour éviter les vrais appels CAPI Meta + Ads
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ events_received: 1 }), { status: 200 }),
  ) as never;
});

describe('dispatchToProviders × attribution gate (phase 2)', () => {
  it('visiteur attribué Meta + purchase → Meta dispatched (match)', async () => {
    await upsertTrackingProvider({
      kind: 'meta',
      status: 'enabled',
      pixelId: '111',
      capiToken: 'tok_meta',
    });
    await upsertAttribution({
      visitorId: 'v_meta_user',
      touch: touch({ channel: 'meta', is_paid: true, click_id: 'fb_x' }),
    });

    const out = await dispatchToProviders(ctx({ anonymousId: 'v_meta_user' }));
    expect(out.results.meta?.status).toBe('sent');
    expect(out.dispatched).toContain('meta');
    // Note : google_ads adapter supports() = false (client-only en
    // Phase 2). La phase 3 (OCI) ajoutera son routing serveur ; à ce
    // moment le gate filtrera aussi google_ads. Cf. dispatch-gate.test.ts
    // pour la couverture exhaustive de la gate seule.
  });

  it('visiteur attribué Google Ads + generate_lead → Meta skipped (attribution)', async () => {
    // NB : depuis C3, Meta `purchase` est broadcast → on teste le gating Meta
    // avec `generate_lead` (Meta `Lead`, resté primary).
    await upsertTrackingProvider({
      kind: 'meta',
      status: 'enabled',
      pixelId: '111',
      capiToken: 'tok_meta',
    });
    await upsertAttribution({
      visitorId: 'v_ads_user',
      touch: touch({ channel: 'google_ads', is_paid: true, click_id: 'g_x' }),
    });
    const out = await dispatchToProviders(
      ctx({ anonymousId: 'v_ads_user', eventName: 'generate_lead' }),
    );
    expect(out.results.meta?.status).toBe('skipped');
    expect(out.results.meta?.error).toContain('attribution_skip');
  });

  it('visiteur attribué Google Ads + purchase → Meta dispatched (C3 : purchase broadcast)', async () => {
    await upsertTrackingProvider({
      kind: 'meta',
      status: 'enabled',
      pixelId: '111',
      capiToken: 'tok_meta',
    });
    await upsertAttribution({
      visitorId: 'v_ads_pur',
      touch: touch({ channel: 'google_ads', is_paid: true, click_id: 'g_pur' }),
    });
    const out = await dispatchToProviders(
      ctx({ anonymousId: 'v_ads_pur', eventName: 'purchase' }),
    );
    // Meta purchase est broadcast → PAS de skip attribution (sent ou autre,
    // mais jamais 'attribution_skip').
    expect(out.results.meta?.error ?? '').not.toContain('attribution_skip');
  });

  it('visiteur attribué Meta + page_view (audience) → Meta dispatched (pas gated)', async () => {
    await upsertTrackingProvider({
      kind: 'meta',
      status: 'enabled',
      pixelId: '111',
      capiToken: 'tok_meta',
    });
    await upsertAttribution({
      visitorId: 'v_aud',
      touch: touch({ channel: 'google_ads', is_paid: true, click_id: 'g_aud' }),
    });
    // Visiteur Google Ads MAIS event = page_view → audience, fire tout de même
    const out = await dispatchToProviders(
      ctx({ anonymousId: 'v_aud', eventName: 'page_view' }),
    );
    expect(out.results.meta?.status).toBe('sent');
  });

  it('visiteur sans snapshot (best-effort) → Meta dispatched (fallback broadcast)', async () => {
    await upsertTrackingProvider({
      kind: 'meta',
      status: 'enabled',
      pixelId: '111',
      capiToken: 'tok_meta',
    });
    // Pas de visitor_attribution row pour v_ghost
    const out = await dispatchToProviders(ctx({ anonymousId: 'v_ghost' }));
    expect(out.results.meta?.status).toBe('sent');
  });

  it('visiteur direct (canal=direct dans snapshot) → broadcast partiel sur tous les pixels payants', async () => {
    await upsertTrackingProvider({
      kind: 'meta',
      status: 'enabled',
      pixelId: '111',
      capiToken: 'tok_meta',
    });
    await upsertAttribution({
      visitorId: 'v_direct',
      touch: touch({ channel: 'direct', is_paid: false }),
    });
    const out = await dispatchToProviders(ctx({ anonymousId: 'v_direct' }));
    expect(out.results.meta?.status).toBe('sent');
  });

  it('skip serialisé pour audit log — providersResults.<kind>.error format stable', async () => {
    // Vérifie que le shape du `error` dans le résultat skip est exactement
    // celui qu'on persiste dans `tracking_events_log.providers_results`
    // (ce qui permet la requête SQL `WHERE … LIKE 'attribution_skip:%'`).
    await upsertTrackingProvider({
      kind: 'meta',
      status: 'enabled',
      pixelId: '111',
      capiToken: 'tok_meta',
    });
    await upsertAttribution({
      visitorId: 'v_audit',
      touch: touch({
        channel: 'google_ads',
        is_paid: true,
        click_id: 'g_audit',
        click_id_field: 'gclid',
      }),
    });
    const out = await dispatchToProviders(
      // generate_lead = primary pour Meta (purchase = broadcast depuis C3).
      ctx({ anonymousId: 'v_audit', eventName: 'generate_lead' }),
    );
    const metaResult = out.results.meta;
    expect(metaResult).toBeDefined();
    expect(metaResult?.status).toBe('skipped');
    expect(metaResult?.error).toMatch(/^attribution_skip:/);
    // Format exact : attribution_skip:<channel> (sans suffixe _vs_ ;
    // c'est la version utilisateur, le _vs_ reste dans reason interne).
    expect(metaResult?.error).toBe('attribution_skip:google_ads');
    // Champs structuraux nécessaires à la persistance JSONB
    expect(metaResult?.attempts).toBe(0);
    expect(metaResult?.latencyMs).toBe(0);
    // Le shape complet doit être JSON-sérialisable
    expect(() => JSON.stringify(metaResult)).not.toThrow();
    const json = JSON.parse(JSON.stringify(metaResult)) as Record<string, unknown>;
    expect(json.error).toBe('attribution_skip:google_ads');
  });
});
