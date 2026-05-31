/**
 * Tests adapter TikTok — pixel client + Events API V1.3 (CAPI).
 *
 * Conventions vérifiées contre la doc TikTok officielle :
 *   - Standard event names : Purchase, AddToCart, ViewContent, InitiateCheckout,
 *     AddPaymentInfo, CompleteRegistration, SubmitForm, Search, Subscribe…
 *     (cf. https://ads.tiktok.com/help/article/standard-events-parameters)
 *   - `purchase` doit mapper sur **Purchase** (canonical TikTok). Le legacy
 *     `CompletePayment` est obsolète depuis l'unification Pixel + CAPI V2 et
 *     n'optimise plus correctement les campagnes Sales.
 *   - Déduplication Pixel ↔ CAPI : champ `event_id` identique, fenêtre 48h
 *     (5min de tolérance inter-canaux).
 *     (cf. https://ads.tiktok.com/help/article/event-deduplication)
 *   - Endpoint : POST https://business-api.tiktok.com/open_api/v1.3/event/track/
 *     Header d'auth : `access-token` (lowercase).
 */
import { describe, expect, it } from 'vitest';

import type { TrackingProvider } from '@/lib/db/types';
import type { DispatchContext } from './types';
import { __test__, tiktokAdapter } from './tiktok';

function provider(overrides: Partial<TrackingProvider> = {}): TrackingProvider {
  return {
    id: 'tpr_tiktok',
    kind: 'tiktok',
    status: 'enabled',
    pixelId: 'D0CAFEBABE12345',
    capiToken: 'encrypted-token',
    capiTokenIv: null,
    capiTokenTag: null,
    testEventCode: 'TT-TEST-01',
    customHead: null,
    customBody: null,
    config: {},
    enabledEvents: [],
    lastEventAt: null,
    errorCount24h: 0,
    lastError: null,
    createdAt: new Date('2026-05-19T10:00:00Z'),
    updatedAt: new Date('2026-05-19T10:00:00Z'),
    ...overrides,
  };
}

function ctx(overrides: Partial<DispatchContext> = {}): DispatchContext {
  return {
    eventName: 'purchase',
    eventId: 'evt_tiktok_dedup_1',
    receivedAt: new Date('2026-05-19T12:00:00Z'),
    pageRoute: '/merci',
    pageUrl: 'https://femiglow.ma/merci',
    pageTitle: 'Merci',
    referrer: 'https://www.tiktok.com/',
    anonymousId: 'anon_tt_123',
    sessionId: 'sess_tt_123',
    userId: null,
    consent: {
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      functional_storage: 'granted',
    },
    uaHash: 'ua_hash_tt',
    ipAnonymized: '197.230.0.0',
    device: 'mobile',
    locale: 'fr-MA',
    params: {
      currency: 'MAD',
      value: 399,
      transaction_id: 'order-tt-42',
      description: 'Kit FemiGlow',
      items: [{ item_id: 'kit-1', item_name: 'Pack FemiGlow', price: 399, quantity: 1 }],
    },
    ttclid: 'E.C.P.preview_TIKTOK_CLICK_ID_42',
    ...overrides,
  };
}

// ─── Payload shape ────────────────────────────────────────────────────

describe('tiktok provider payload', () => {
  it('builds a CAPI V1.3 envelope with event_source=web and pixel as event_source_id', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.event_source).toBe('web');
    expect(payload.event_source_id).toBe('D0CAFEBABE12345');
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data).toHaveLength(1);
  });

  it('propagates event_id verbatim for Pixel ↔ CAPI deduplication', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.data[0].event_id).toBe('evt_tiktok_dedup_1');
  });

  it('encodes event_time as Unix seconds (not milliseconds)', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.data[0].event_time).toBe(
      Math.floor(new Date('2026-05-19T12:00:00Z').getTime() / 1000),
    );
    expect(typeof payload.data[0].event_time).toBe('number');
  });

  it('includes ttclid in user object when present', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.data[0].user.ttclid).toBe('E.C.P.preview_TIKTOK_CLICK_ID_42');
  });

  it('omits ttclid when not provided', () => {
    const payload = __test__.buildPayload(provider(), ctx({ ttclid: undefined })) as any;
    expect(payload.data[0].user.ttclid).toBeUndefined();
  });

  it('sets test_event_code at envelope level (not per-event) when provider has one', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.test_event_code).toBe('TT-TEST-01');
  });

  it('omits test_event_code when provider.testEventCode is null', () => {
    const payload = __test__.buildPayload(provider({ testEventCode: null }), ctx()) as any;
    expect('test_event_code' in payload).toBe(false);
  });

  it('hashes external_id with SHA-256 (TikTok CAPI requires hashed value)', () => {
    const payload = __test__.buildPayload(provider(), ctx({ externalId: 'user-42' })) as any;
    expect(payload.data[0].user.external_id).toEqual([
      // sha256('user-42') — TikTok expects array even with a single value
      expect.stringMatching(/^[a-f0-9]{64}$/),
    ]);
  });

  it('falls back external_id to userId then anonymousId', () => {
    const p1 = __test__.buildPayload(provider(), ctx({ externalId: undefined, userId: 'u-9' })) as any;
    const p2 = __test__.buildPayload(provider(), ctx({ externalId: undefined, userId: null })) as any;
    expect(Array.isArray(p1.data[0].user.external_id)).toBe(true);
    expect(p1.data[0].user.external_id[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(Array.isArray(p2.data[0].user.external_id)).toBe(true);
    expect(p2.data[0].user.external_id[0]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('passes ip_anonymized and ua hash through user fields', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.data[0].user.ip).toBe('197.230.0.0');
    expect(payload.data[0].user.user_agent).toBe('ua_hash_tt');
  });

  it('encodes email and phone as arrays of SHA-256 hashes (TikTok requirement)', () => {
    const payload = __test__.buildPayload(provider(), ctx({
      identity: { email: 'Sara@FemiGlow.MA', phone: '+212 6 11 22 33 44' },
    })) as any;
    expect(Array.isArray(payload.data[0].user.email)).toBe(true);
    expect(payload.data[0].user.email).toHaveLength(1);
    expect(payload.data[0].user.email[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(Array.isArray(payload.data[0].user.phone)).toBe(true);
    expect(payload.data[0].user.phone[0]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashes identity with normalized inputs (lowercase email, digits-only phone)', () => {
    const crypto = require('node:crypto') as typeof import('node:crypto');
    const payload = __test__.buildPayload(provider(), ctx({
      identity: { email: '  TEST@femiglow.MA  ', phone: '+212-611-22-33-44' },
    })) as any;
    const expectedEmail = crypto.createHash('sha256').update('test@femiglow.ma').digest('hex');
    const expectedPhone = crypto.createHash('sha256').update('212611223344').digest('hex');
    expect(payload.data[0].user.email[0]).toBe(expectedEmail);
    expect(payload.data[0].user.phone[0]).toBe(expectedPhone);
  });

  it('omits email/phone when identity is missing', () => {
    const payload = __test__.buildPayload(provider(), ctx({ identity: undefined })) as any;
    expect(payload.data[0].user.email).toBeUndefined();
    expect(payload.data[0].user.phone).toBeUndefined();
  });

  it('builds properties.contents from params.items with content_id/name/price/quantity', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.data[0].properties.contents).toEqual([
      {
        content_id: 'kit-1',
        content_name: 'Pack FemiGlow',
        price: 399,
        quantity: 1,
      },
    ]);
  });

  it('defaults quantity to 1 when item.quantity is undefined', () => {
    const payload = __test__.buildPayload(provider(), ctx({
      params: { items: [{ item_id: 'sku-1', item_name: 'X', price: 100 }] },
    })) as any;
    expect(payload.data[0].properties.contents[0].quantity).toBe(1);
  });

  it('omits properties.contents when params.items is missing', () => {
    const payload = __test__.buildPayload(provider(), ctx({
      params: { currency: 'MAD', value: 100 },
    })) as any;
    expect(payload.data[0].properties.contents).toBeUndefined();
  });

  it('forwards currency, value and order_id from params', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.data[0].properties.currency).toBe('MAD');
    expect(payload.data[0].properties.value).toBe(399);
    expect(payload.data[0].properties.order_id).toBe('order-tt-42');
  });

  it('exposes page.url and page.referrer (fallback empty string)', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.data[0].page.url).toBe('https://femiglow.ma/merci');
    expect(payload.data[0].page.referrer).toBe('https://www.tiktok.com/');

    const noRef = __test__.buildPayload(provider(), ctx({ referrer: undefined })) as any;
    expect(noRef.data[0].page.referrer).toBe('');
  });
});

// ─── Event mapping coverage ──────────────────────────────────────────

describe('tiktok event mapping coverage (TikTok canonical names)', () => {
  // Source of truth : ads.tiktok.com/help/article/standard-events-parameters
  // Note : la liste canonique unifie Pixel + CAPI V2 sur **Purchase**
  // (l'ancien `CompletePayment` de l'Events API V1.3 est legacy).
  const TIKTOK_MAPPED_EVENTS: Record<string, string> = {
    page_view: 'Pageview',
    view_item: 'ViewContent',
    add_to_cart: 'AddToCart',
    checkout_intent: 'InitiateCheckout',
    begin_checkout: 'InitiateCheckout',
    add_payment_info: 'AddPaymentInfo',
    purchase: 'Purchase',
    generate_lead: 'SubmitForm',
    sign_up: 'CompleteRegistration',
    search: 'Search',
  };

  for (const [fgEvent, expectedTikTokName] of Object.entries(TIKTOK_MAPPED_EVENTS)) {
    it(`${fgEvent} → ${expectedTikTokName}`, () => {
      const payload = __test__.buildPayload(provider(), ctx({ eventName: fgEvent })) as any;
      expect(payload.data[0].event).toBe(expectedTikTokName);
    });
  }

  it('falls back to "CustomEvent" for events not mapped for TikTok', () => {
    const payload = __test__.buildPayload(provider(), ctx({ eventName: 'fg_journal_read_75' })) as any;
    expect(payload.data[0].event).toBe('CustomEvent');
  });

  it('uses ctx.resolvedMappings when provided (V1.1+ dispatcher path)', () => {
    const payload = __test__.buildPayload(provider(), ctx({
      eventName: 'whatever',
      resolvedMappings: {
        tiktok: { mappedName: 'StartTrial', isCustom: false, notes: null },
      },
    })) as any;
    expect(payload.data[0].event).toBe('StartTrial');
  });
});

// ─── CAPI V1.3 spec compliance ───────────────────────────────────────

describe('tiktok CAPI V1.3 format compliance', () => {
  it('event_source is exactly "web" (lowercase, not "WEB")', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.event_source).toBe('web');
    expect(payload.event_source).not.toBe('WEB');
  });

  it('event_source_id is the pixel id (the same value used in ttq.load)', () => {
    const payload = __test__.buildPayload(provider({ pixelId: 'CBABCDEFGHIJKLM' }), ctx()) as any;
    expect(payload.event_source_id).toBe('CBABCDEFGHIJKLM');
  });

  it('data[].event must be a non-empty string (never null/undefined)', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(typeof payload.data[0].event).toBe('string');
    expect(payload.data[0].event.length).toBeGreaterThan(0);
  });

  it('Purchase event carries currency, value and order_id (Sales optimization signals)', () => {
    const payload = __test__.buildPayload(provider(), ctx({ eventName: 'purchase' })) as any;
    expect(payload.data[0].event).toBe('Purchase');
    expect(payload.data[0].properties.currency).toBe('MAD');
    expect(payload.data[0].properties.value).toBe(399);
    expect(payload.data[0].properties.order_id).toBe('order-tt-42');
  });

  it('does NOT emit the legacy "CompletePayment" name for purchase events', () => {
    // Anti-régression : la mapping doit utiliser le nom canonique unifié.
    const payload = __test__.buildPayload(provider(), ctx({ eventName: 'purchase' })) as any;
    expect(payload.data[0].event).not.toBe('CompletePayment');
  });
});

// ─── Client snippet ──────────────────────────────────────────────────

describe('tiktok client snippet', () => {
  it('returns the official TikTok Pixel bootstrap with ttq.load(pixelId)', () => {
    const snippet = tiktokAdapter.clientSnippet!(provider({ pixelId: 'XYZ123' }));
    expect(snippet).not.toBeNull();
    expect(snippet).toContain("ttq.load('XYZ123')");
  });

  it('auto-fires ttq.page() on load (Pixel sends a first Pageview)', () => {
    const snippet = tiktokAdapter.clientSnippet!(provider());
    expect(snippet).toContain('ttq.page()');
  });

  it('points to the official TikTok events SDK URL', () => {
    const snippet = tiktokAdapter.clientSnippet!(provider());
    expect(snippet).toContain('https://analytics.tiktok.com/i18n/pixel/events.js');
  });

  it('declares the TiktokAnalyticsObject alias = "ttq"', () => {
    const snippet = tiktokAdapter.clientSnippet!(provider());
    expect(snippet).toContain('TiktokAnalyticsObject');
    expect(snippet).toContain("'ttq'");
  });

  it('returns null when status is not "enabled"', () => {
    expect(tiktokAdapter.clientSnippet!(provider({ status: 'disabled' }))).toBeNull();
  });

  it('returns null when pixelId is missing', () => {
    expect(tiktokAdapter.clientSnippet!(provider({ pixelId: null }))).toBeNull();
    expect(tiktokAdapter.clientSnippet!(provider({ pixelId: '' }))).toBeNull();
  });
});

// ─── Adapter contract ────────────────────────────────────────────────

describe('tiktok adapter contract', () => {
  it('declares kind = "tiktok"', () => {
    expect(tiktokAdapter.kind).toBe('tiktok');
  });

  it('cspHosts whitelists analytics.tiktok.com (scripts) and business-api.tiktok.com (XHR)', () => {
    const hosts = tiktokAdapter.cspHosts();
    expect(hosts.scriptSrc).toContain('https://analytics.tiktok.com');
    expect(hosts.connectSrc).toContain('https://analytics.tiktok.com');
    expect(hosts.connectSrc).toContain('https://business-api.tiktok.com');
  });

  it('supports() returns true for events mapped to a TikTok standard name', () => {
    expect(tiktokAdapter.supports('purchase')).toBe(true);
    expect(tiktokAdapter.supports('add_to_cart')).toBe(true);
    expect(tiktokAdapter.supports('view_item')).toBe(true);
  });

  it('supports() returns false for FemiGlow-internal events without TikTok mapping', () => {
    expect(tiktokAdapter.supports('fg_journal_read_75')).toBe(false);
    expect(tiktokAdapter.supports('wizard_error')).toBe(false);
  });
});
