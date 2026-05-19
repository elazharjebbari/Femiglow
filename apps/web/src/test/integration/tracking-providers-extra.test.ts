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
  it('envoie un event complet sur tr.snapchat.com avec dedup, attribution et ecommerce', async () => {
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
    const out = await dispatchToProviders(
      makeCtx({
        anonymousId: 'anon_snap_42',
        params: {
          transaction_id: 'tx_99',
          currency: 'MAD',
          value: 99,
          event_tag: 'checkout_paid',
          description: 'Commande test Snapchat',
          items: [
            { item_id: 'sku_a', item_name: 'Soin', item_category: 'skincare', quantity: 2, price: 49.5 },
          ],
        },
        userData: {
          sha256_email_address: 'e'.repeat(64),
          sha256_phone_number: 'f'.repeat(64),
          address: {
            sha256_first_name: 'a'.repeat(64),
            city: 'Marrakech',
            country: 'MA',
          },
        },
        attribution: {
          channel: 'snapchat',
          is_paid: true,
          strategy: 'paid_social',
          reason: 'click_id',
          click_id: 'sc-click-99',
          click_id_field: 'ScCid',
          utm: { source: 'snapchat', campaign: 'ramadan' },
        },
      }),
    );
    expect(out.dispatched).toContain('snap');
    const c = captured as {
      data: Array<{
        event_name: string;
        action_source: string;
        event_id: string;
        user_data: Record<string, unknown>;
        custom_data: Record<string, unknown>;
      }>;
    };
    // Source de vérité : `lib/tracking/providers/snap.ts` (CAPI v3 spec).
    //  - `action_source` : `'website'` (string minuscule, spec officielle).
    //  - `user_data`     : `ct` (city) et `country` ; pas de `geo_*`.
    //  - `custom_data`   : `order_id` (pas `transaction_id`), `content_ids`
    //    (pas `item_ids`), `content_category` Array (pas string),
    //    `number_items` Array<string> (pas number). Le champ `event_id` est
    //    dupliqué dans custom_data (utile pour dedup côté Snap).
    //
    // Les champs `event_tag`, `description`, `client_deduplication_id`,
    // `uuid_c1` ne sont pas dans la spec CAPI v3 ; l'adapter ne les pose
    // donc pas. Les retirer des assertions.
    expect(c.data[0]).toMatchObject({
      event_name: 'PURCHASE',
      action_source: 'website',
      event_id: '01900000-0000-7000-8000-000000000099',
    });
    expect(c.data[0]?.user_data).toMatchObject({
      em: ['e'.repeat(64)],
      ph: ['f'.repeat(64)],
      fn: ['a'.repeat(64)],
      ct: 'Marrakech',
      country: 'MA',
      sc_click_id: 'sc-click-99',
    });
    expect(c.data[0]?.custom_data).toMatchObject({
      currency: 'MAD',
      value: 99,
      order_id: 'tx_99',
      content_ids: ['sku_a'],
      content_category: ['skincare'],
      number_items: ['2'],
    });
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

  it('clientSnippet retourne null — GTM est désormais bootstrappé SSR (GtmHeadScript)', () => {
    // GTM doit être chargé dans le HTML initial pour que Tag Assistant
    // / Preview Mode détecte le conteneur. L'injection est donc faite
    // server-side via <GtmHeadScript />, et l'adapter renvoie null
    // pour que PixelLoader (client) ne le re-charge pas.
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
    expect(snippet).toBeNull();
  });
});
