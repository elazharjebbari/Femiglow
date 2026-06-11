/**
 * Suite d'intégration MSW — adapters Meta, Google GA4, TikTok via dispatcher.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse, server } from '@/test/msw/server';
import { resetMemoryStore } from '@/lib/db/client';
import { upsertTrackingProvider } from '@/lib/db/queries/tracking/providers';
import { dispatchToProviders } from '@/lib/tracking/server/dispatcher';
import { GRANTED_CONSENT, DENIED_CONSENT } from '@/lib/tracking/consent';
import type { DispatchContext } from '@/lib/tracking/providers/types';

vi.mock('@/lib/env', async (orig) => {
  const mod = (await orig()) as { env: Record<string, unknown> };
  return {
    ...mod,
    env: { ...mod.env, WEBHOOK_SECRET_KEY: 'test-key-for-tracking-providers-32chars-AAA' },
  };
});

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  resetMemoryStore();
});

function makeCtx(overrides: Partial<DispatchContext> = {}): DispatchContext {
  return {
    eventName: 'purchase',
    eventId: '01900000-0000-7000-8000-000000000001',
    receivedAt: new Date('2026-05-04T12:00:00Z'),
    pageRoute: '/checkout',
    pageUrl: 'https://femiglow.ma/checkout',
    pageTitle: 'Checkout',
    referrer: '',
    anonymousId: 'aid_test_42',
    sessionId: 'sid_test_42',
    userId: null,
    consent: { ...GRANTED_CONSENT },
    uaHash: 'a'.repeat(32),
    ipAnonymized: '203.0.113.0',
    device: 'desktop',
    locale: 'fr-MA',
    params: {
      transaction_id: 'tx_42',
      currency: 'MAD',
      value: 199,
      items: [{ item_id: 'sku_1', item_name: 'Soin', quantity: 1, price: 199, currency: 'MAD' }],
    },
    identity: { email: 'test@femiglow.ma' },
    ...overrides,
  };
}

describe('Adapter Meta', () => {
  it('envoie un event sur graph.facebook.com et marque sent', async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post('https://graph.facebook.com/:version/:pixel/events', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ events_received: 1 });
      }),
    );
    await upsertTrackingProvider({
      kind: 'meta',
      status: 'enabled',
      pixelId: '1234567890',
      capiToken: 'meta-secret-token',
    });
    const out = await dispatchToProviders(makeCtx());
    expect(out.dispatched).toContain('meta');
    expect(out.results.meta?.status).toBe('sent');
    const body = capturedBody as { data: Array<{ event_name: string; user_data: { em?: string } }> };
    expect(body.data[0]?.event_name).toBe('Purchase');
    expect(body.data[0]?.user_data.em).toMatch(/^[0-9a-f]{64}$/);
  });

  it('skip si provider disabled', async () => {
    await upsertTrackingProvider({
      kind: 'meta',
      status: 'disabled',
      pixelId: '123',
      capiToken: 'tok',
    });
    const out = await dispatchToProviders(makeCtx());
    expect(out.results.meta).toBeUndefined();
  });

  it('skip si event non mappé pour Meta', async () => {
    await upsertTrackingProvider({
      kind: 'meta',
      status: 'enabled',
      pixelId: '123',
      capiToken: 'tok',
    });
    const out = await dispatchToProviders(makeCtx({ eventName: 'scroll_depth' }));
    expect(out.results.meta).toBeUndefined();
  });

  it('marque failed sur 500 upstream', async () => {
    server.use(
      http.post('https://graph.facebook.com/:version/:pixel/events', () =>
        HttpResponse.json({ error: 'oops' }, { status: 500 }),
      ),
    );
    await upsertTrackingProvider({
      kind: 'meta',
      status: 'enabled',
      pixelId: '123',
      capiToken: 'tok',
    });
    const out = await dispatchToProviders(makeCtx());
    expect(out.results.meta?.status).toBe('failed');
    expect(out.results.meta?.attempts).toBeGreaterThan(1);
  });

  it('skip si consent ad_storage denied', async () => {
    await upsertTrackingProvider({
      kind: 'meta',
      status: 'enabled',
      pixelId: '123',
      capiToken: 'tok',
    });
    const out = await dispatchToProviders(
      makeCtx({ consent: { ...DENIED_CONSENT, analytics_storage: 'granted' } }),
    );
    expect(out.results.meta?.status).toBe('skipped');
    expect(out.results.meta?.error).toBe('consent_denied');
  });

  it('inclut test_event_code quand configuré', async () => {
    let capturedBody: { test_event_code?: string } = {};
    server.use(
      http.post('https://graph.facebook.com/:version/:pixel/events', async ({ request }) => {
        capturedBody = (await request.json()) as { test_event_code?: string };
        return HttpResponse.json({ events_received: 1 });
      }),
    );
    await upsertTrackingProvider({
      kind: 'meta',
      status: 'enabled',
      pixelId: '123',
      capiToken: 'tok',
      testEventCode: 'TEST12345',
    });
    await dispatchToProviders(makeCtx());
    expect(capturedBody.test_event_code).toBe('TEST12345');
  });
});

// T-07 (audit 2026-05-31) — GA4 = client GTM uniquement. Le dispatch MP
// serveur ne fire QUE pour les events server-scope (ex. `refund`), sans tag
// gaawe client → pas de double-comptage. Ces tests valident donc GA4 via un
// event server-scope (`refund`), pas via un event client (`purchase`).
describe('Adapter Google GA4 (server-scope only — T-07)', () => {
  it('envoie un event server-scope sur Measurement Protocol', async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post('https://www.google-analytics.com/mp/collect', async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await upsertTrackingProvider({
      kind: 'google_ga4',
      status: 'enabled',
      pixelId: 'G-ABC123',
      capiToken: 'api-secret',
    });
    const out = await dispatchToProviders(makeCtx({ eventName: 'refund' }));
    expect(out.dispatched).toContain('google_ga4');
    const body = capturedBody as {
      client_id: string;
      events: Array<{ name: string; params: Record<string, unknown> }>;
      consent: Record<string, string>;
    };
    expect(body.client_id).toBe('aid_test_42');
    expect(body.events[0]?.name).toBe('refund');
    expect(body.consent.ad_user_data).toBe('GRANTED');
  });

  it('skip si analytics_storage denied', async () => {
    await upsertTrackingProvider({
      kind: 'google_ga4',
      status: 'enabled',
      pixelId: 'G-ABC123',
      capiToken: 'api-secret',
    });
    const out = await dispatchToProviders(
      makeCtx({ eventName: 'refund', consent: { ...DENIED_CONSENT, ad_storage: 'granted' } }),
    );
    expect(out.results.google_ga4?.status).toBe('skipped');
  });

  it('respecte enabledEvents si défini', async () => {
    await upsertTrackingProvider({
      kind: 'google_ga4',
      status: 'enabled',
      pixelId: 'G-ABC',
      capiToken: 'api-secret',
      enabledEvents: ['view_item'],
    });
    const out = await dispatchToProviders(makeCtx({ eventName: 'refund' }));
    expect(out.results.google_ga4?.error).toBe('event_disabled');
  });
});

describe('Adapter TikTok', () => {
  it('envoie un event sur business-api.tiktok.com', async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post(
        'https://business-api.tiktok.com/open_api/v1.3/event/track/',
        async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ code: 0 });
        },
      ),
    );
    await upsertTrackingProvider({
      kind: 'tiktok',
      status: 'enabled',
      pixelId: 'TT_PIXEL_42',
      capiToken: 'tt-token',
    });
    const out = await dispatchToProviders(makeCtx());
    expect(out.dispatched).toContain('tiktok');
    const body = capturedBody as {
      event_source_id: string;
      data: Array<{ event: string; user: { external_id: string[] } }>;
    };
    expect(body.event_source_id).toBe('TT_PIXEL_42');
    expect(body.data[0]?.event).toBe('Purchase');
    expect(body.data[0]?.user.external_id[0]).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('Dispatcher multi-providers', () => {
  it('dispatche en parallèle sur tous les providers enabled', async () => {
    server.use(
      http.post('https://graph.facebook.com/:v/:p/events', () =>
        HttpResponse.json({ events_received: 1 }),
      ),
      http.post('https://www.google-analytics.com/mp/collect', () =>
        new HttpResponse(null, { status: 204 }),
      ),
      http.post(
        'https://business-api.tiktok.com/open_api/v1.3/event/track/',
        () => HttpResponse.json({ code: 0 }),
      ),
    );
    await upsertTrackingProvider({
      kind: 'meta',
      status: 'enabled',
      pixelId: '1',
      capiToken: 't1',
    });
    await upsertTrackingProvider({
      kind: 'google_ga4',
      status: 'enabled',
      pixelId: 'G',
      capiToken: 't2',
    });
    await upsertTrackingProvider({
      kind: 'tiktok',
      status: 'enabled',
      pixelId: 'TT',
      capiToken: 't3',
    });
    const out = await dispatchToProviders(makeCtx());
    // T-07 — `purchase` est un event CLIENT : GA4 part via le tag gaawe (GTM),
    // pas via le MP serveur (sinon double-comptage). Le dispatch serveur ne
    // contient donc que Meta + TikTok (CAPI). GA4 serveur = events server-scope.
    expect(out.dispatched.sort()).toEqual(['meta', 'tiktok']);
  });

  it("ne dispatch rien si aucun provider n'est enabled", async () => {
    const out = await dispatchToProviders(makeCtx());
    expect(out.dispatched).toEqual([]);
    expect(Object.keys(out.results)).toHaveLength(0);
  });
});
