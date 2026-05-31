/**
 * Suite d'intégration — POST /api/track.
 * Couvre validation, dedup, consent gating, rate-limit, batch et persistance.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { POST } from '@/app/api/track/route';
import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import { clearDedupCache } from '@/lib/tracking/server/dedup';
import { uuidv7 } from '@/lib/tracking/uuid';
import type { TrackingConsentState } from '@/lib/db/types';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  resetMemoryStore();
  clearDedupCache();
});

const GRANTED: TrackingConsentState = {
  ad_storage: 'granted',
  analytics_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
  functional_storage: 'granted',
};

const DENIED: TrackingConsentState = {
  ad_storage: 'denied',
  analytics_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  functional_storage: 'denied',
};

function makeEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    event: 'page_view',
    event_id: uuidv7(),
    timestamp: new Date().toISOString(),
    schema_version: 1,
    consent: GRANTED,
    page: {
      url: 'https://femiglow.ma/',
      path: '/',
      title: 'FemiGlow',
      referrer: '',
      locale: 'fr-MA',
    },
    user: { anonymous_id: 'aid_test_1234567890', session_id: 'sid_test_1234567890' },
    params: { page_path: '/', page_title: 'Accueil' },
    ...overrides,
  };
}

function buildRequest(body: unknown, ip = '203.0.113.10') {
  return new Request('http://localhost/api/track', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      'user-agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      'accept-language': 'fr-MA,fr;q=0.9',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/track', () => {
  it('200/202 : événement valide accepté et persisté', async () => {
    const res = await POST(buildRequest({ events: [makeEvent()] }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, accepted: 1, rejected: 0, duplicates: 0 });
    expect(memoryStore().trackingEventsLog.size).toBe(1);
  });

  it('400 : corps JSON invalide', async () => {
    const req = new Request('http://localhost/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.11' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('400 : batch sans events rejeté', async () => {
    const res = await POST(buildRequest({ events: [] }));
    expect(res.status).toBe(400);
  });

  it('400 : batch trop volumineux (> 50)', async () => {
    const events = Array.from({ length: 51 }, () => makeEvent());
    const res = await POST(buildRequest({ events }));
    expect(res.status).toBe(400);
  });

  it('rejette les événements inconnus mais accepte le reste', async () => {
    const res = await POST(
      buildRequest({
        events: [makeEvent({ event: 'unknown_event' }), makeEvent()],
      }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(1);
    expect(body.rejected).toBe(1);
  });

  it('rejette les params qui ne valident pas le schéma de l\'événement', async () => {
    const res = await POST(
      buildRequest({
        events: [
          makeEvent({
            event: 'purchase',
            params: { items: [], currency: 'MAD' },
          }),
        ],
      }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.rejected).toBe(1);
  });

  it('accepte purchase valide et marque is_conversion = true', async () => {
    const res = await POST(
      buildRequest({
        events: [
          makeEvent({
            event: 'purchase',
            params: {
              transaction_id: 'tx_1',
              currency: 'MAD',
              value: 199,
              items: [
                {
                  item_id: 'sku_1',
                  item_name: 'Soin',
                  price: 199,
                  quantity: 1,
                  currency: 'MAD',
                },
              ],
            },
          }),
        ],
      }),
    );
    expect(res.status).toBe(202);
    const stored = Array.from(memoryStore().trackingEventsLog.values());
    expect(stored).toHaveLength(1);
    expect(stored[0]?.isConversion).toBe(true);
  });

  it('accepte user_data et attribution Snapchat sans rejeter le batch', async () => {
    const res = await POST(
      buildRequest({
        events: [
          makeEvent({
            event: 'purchase',
            params: {
              transaction_id: 'tx_snap_1',
              currency: 'MAD',
              value: 249,
              ScCid: 'sc-click-query-1',
              event_tag: 'snap_checkout',
              description: 'Commande attribuée Snapchat',
              geo_city: 'Marrakech',
              geo_country: 'MA',
              items: [
                {
                  item_id: 'sku_snap_1',
                  item_name: 'Routine',
                  item_category: 'skincare',
                  price: 249,
                  quantity: 1,
                  currency: 'MAD',
                },
              ],
            },
            user_data: {
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
              click_id: 'sc-click-query-1',
              click_id_field: 'ScCid',
              utm: { source: 'snapchat', medium: 'paid_social', campaign: 'snap_test' },
            },
          }),
        ],
      }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, accepted: 1, rejected: 0, duplicates: 0 });
    const stored = Array.from(memoryStore().trackingEventsLog.values());
    expect(stored).toHaveLength(1);
    expect(stored[0]?.isConversion).toBe(true);
    expect(stored[0]?.payload).toMatchObject({
      transaction_id: 'tx_snap_1',
      ScCid: 'sc-click-query-1',
      geo_city: 'Marrakech',
    });
  });

  it('dedup : un même event_id n\'est compté qu\'une fois', async () => {
    const eventId = uuidv7();
    const res = await POST(
      buildRequest({
        events: [makeEvent({ event_id: eventId }), makeEvent({ event_id: eventId })],
      }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(1);
    expect(body.duplicates).toBe(1);
    expect(memoryStore().trackingEventsLog.size).toBe(1);
  });

  it('dedup persiste entre requêtes successives', async () => {
    const event = makeEvent();
    await POST(buildRequest({ events: [event] }));
    const res = await POST(buildRequest({ events: [event] }));
    const body = await res.json();
    expect(body.accepted).toBe(0);
    expect(body.duplicates).toBe(1);
  });

  it('consent denied bloque les événements non-consent', async () => {
    const res = await POST(
      buildRequest({
        events: [makeEvent({ consent: DENIED })],
      }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(0);
    expect(body.rejected).toBe(1);
    expect(memoryStore().trackingEventsLog.size).toBe(0);
  });

  it('consent denied autorise fg_consent_change', async () => {
    const res = await POST(
      buildRequest({
        events: [
          makeEvent({
            event: 'fg_consent_change',
            consent: DENIED,
            params: { ad_storage: 'denied', analytics_storage: 'denied' },
          }),
        ],
      }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(1);
  });

  it('rate-limit : 60 requêtes/min/IP, la 61e renvoie 429', async () => {
    const ip = '203.0.113.99';
    for (let i = 0; i < 60; i += 1) {
      const res = await POST(buildRequest({ events: [makeEvent()] }, ip));
      expect(res.status).toBe(202);
    }
    const res = await POST(buildRequest({ events: [makeEvent()] }, ip));
    expect(res.status).toBe(429);
  });

  it('enrichit l\'événement avec uaHash + ipAnonymized + device + locale', async () => {
    await POST(buildRequest({ events: [makeEvent()] }));
    const stored = Array.from(memoryStore().trackingEventsLog.values())[0];
    expect(stored?.uaHash).toMatch(/^[0-9a-f]{32}$/);
    expect(stored?.ipAnonymized).toBe('203.0.113.0');
    expect(stored?.device).toBe('mobile');
    expect(stored?.locale).toBe('fr-MA');
  });

  it('batch mixte : 1 valide + 1 invalide → accepte 1, rejette 1', async () => {
    const res = await POST(
      buildRequest({
        events: [
          makeEvent(),
          makeEvent({ event: 'scroll_depth', params: { percent_scrolled: 33 } }),
        ],
      }),
    );
    const body = await res.json();
    expect(body.accepted).toBe(1);
    expect(body.rejected).toBe(1);
  });

  it('persiste page_route, anonymous_id et session_id correctement', async () => {
    await POST(
      buildRequest({
        events: [
          makeEvent({
            page: {
              url: 'https://femiglow.ma/manifeste',
              path: '/manifeste',
              title: 'Manifeste',
              referrer: '',
              locale: 'fr-MA',
            },
            user: { anonymous_id: 'aid_alpha_42', session_id: 'sid_alpha_42' },
          }),
        ],
      }),
    );
    const stored = Array.from(memoryStore().trackingEventsLog.values())[0];
    expect(stored?.pageRoute).toBe('/manifeste');
    expect(stored?.anonymousId).toBe('aid_alpha_42');
    expect(stored?.sessionId).toBe('sid_alpha_42');
  });

  it('schema_version par défaut = 1 quand non fourni', async () => {
    const ev = makeEvent();
    delete (ev as { schema_version?: number }).schema_version;
    await POST(buildRequest({ events: [ev] }));
    const stored = Array.from(memoryStore().trackingEventsLog.values())[0];
    expect(stored?.schemaVersion).toBe(1);
  });

  it('accepte 25 événements valides en batch', async () => {
    const events = Array.from({ length: 25 }, () => makeEvent());
    const res = await POST(buildRequest({ events }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(25);
  });

  it('rejette user.anonymous_id trop court', async () => {
    const ev = makeEvent({ user: { anonymous_id: 'a', session_id: 'sid_test_1234567890' } });
    const res = await POST(buildRequest({ events: [ev] }));
    expect(res.status).toBe(400);
  });
});
