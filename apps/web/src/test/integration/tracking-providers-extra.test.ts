/**
 * Suite d'intégration MSW — adapters Snap, Pinterest, GTM (client only).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse, server } from '@/test/msw/server';
import { resetMemoryStore } from '@/lib/db/client';
import { upsertTrackingProvider } from '@/lib/db/queries/tracking/providers';
import { dispatchToProviders } from '@/lib/tracking/server/dispatcher';
import { GRANTED_CONSENT } from '@/lib/tracking/consent';
import { getAdapter } from '@/lib/tracking/providers/registry';
import type { DispatchContext } from '@/lib/tracking/providers/types';

vi.mock('@/lib/env', async (orig) => {
  const mod = (await orig()) as { env: Record<string, unknown> };
  return {
    ...mod,
    env: { ...mod.env, WEBHOOK_SECRET_KEY: 'extra-test-key-32chars-AAAAAAAAAAAA' },
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
    eventId: '01900000-0000-7000-8000-000000000099',
    receivedAt: new Date('2026-05-04T12:00:00Z'),
    pageRoute: '/checkout',
    pageUrl: 'https://femiglow.ma/checkout',
    pageTitle: 'Checkout',
    referrer: '',
    anonymousId: 'aid_x',
    sessionId: 'sid_x',
    userId: null,
    consent: { ...GRANTED_CONSENT },
    uaHash: 'b'.repeat(32),
    ipAnonymized: '203.0.113.0',
    device: 'desktop',
    locale: 'fr-MA',
    params: {
      transaction_id: 'tx_99',
      currency: 'MAD',
      value: 99,
      items: [{ item_id: 'sku_a', item_name: 'Soin', quantity: 1, price: 99 }],
    },
    identity: { email: 'a@b.fr' },
    ...overrides,
  };
}

describe('Adapter Snap', () => {
  it('envoie un event sur tr.snapchat.com', async () => {
    let captured: unknown = null;
    server.use(
      http.post('https://tr.snapchat.com/v3/:pixel/events', async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ status: 'OK' });
      }),
    );
    await upsertTrackingProvider({
      kind: 'snap',
      status: 'enabled',
      pixelId: 'snap_pix',
      capiToken: 'snap-token',
    });
    const out = await dispatchToProviders(makeCtx());
    expect(out.dispatched).toContain('snap');
    const c = captured as { data: Array<{ event_name: string }> };
    expect(c.data[0]?.event_name).toBe('PURCHASE');
  });

  it('skip si access_token absent', async () => {
    await upsertTrackingProvider({
      kind: 'snap',
      status: 'enabled',
      pixelId: 'snap_pix',
    });
    const out = await dispatchToProviders(makeCtx());
    expect(out.results.snap?.error).toBe('access_token_missing');
  });
});

describe('Adapter Pinterest', () => {
  it('envoie un event sur api.pinterest.com', async () => {
    let captured: unknown = null;
    server.use(
      http.post('https://api.pinterest.com/v5/ad_accounts/:id/events', async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ events: [{ status: 'processed' }] });
      }),
    );
    await upsertTrackingProvider({
      kind: 'pinterest',
      status: 'enabled',
      pixelId: 'ad_acct_42',
      capiToken: 'pin-token',
    });
    const out = await dispatchToProviders(makeCtx());
    expect(out.dispatched).toContain('pinterest');
    const c = captured as { data: Array<{ event_name: string }> };
    expect(c.data[0]?.event_name).toBe('checkout');
  });
});

describe('Adapter GTM', () => {
  it('dispatch retourne skipped client_only', async () => {
    await upsertTrackingProvider({
      kind: 'gtm',
      status: 'enabled',
      pixelId: 'GTM-ABC123',
    });
    // GTM ne participe pas au dispatch serveur (consent functional_storage requis)
    const out = await dispatchToProviders(
      makeCtx({ consent: { ...GRANTED_CONSENT } }),
    );
    expect(out.results.gtm?.status).toBe('skipped');
    expect(out.results.gtm?.error).toBe('client_only');
  });

  it('clientSnippet renvoie un script avec le GTM ID', () => {
    const adapter = getAdapter('gtm');
    expect(adapter).toBeTruthy();
    const snippet = adapter!.clientSnippet?.({
      id: 'tpr_test',
      kind: 'gtm',
      status: 'enabled',
      pixelId: 'GTM-XYZ',
      capiToken: null,
      capiTokenIv: null,
      capiTokenTag: null,
      testEventCode: null,
      customHead: null,
      customBody: null,
      config: {},
      enabledEvents: [],
      lastEventAt: null,
      errorCount24h: 0,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(snippet).toContain('GTM-XYZ');
  });
});
