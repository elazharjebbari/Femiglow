import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TrackingProvider } from '@/lib/db/types';
import { decryptCapiToken } from '@/lib/db/queries/tracking/providers';
import { fetchWithRetry } from './retry';
import type { DispatchContext } from './types';
import { metaAdapter } from './meta';

// Mock decryptCapiToken
vi.mock('@/lib/db/queries/tracking/providers', () => ({
  decryptCapiToken: vi.fn(() => 'test-meta-capi-token-abc123'),
}));

// Mock fetchWithRetry
vi.mock('./retry', () => ({
  fetchWithRetry: vi.fn(async (_url: string, _init: RequestInit) => ({
    ok: true,
    status: 200,
    body: JSON.stringify({ success: true }),
    attempts: 1,
  })),
}));

beforeEach(() => {
  vi.mocked(decryptCapiToken).mockClear();
  vi.mocked(decryptCapiToken).mockReturnValue('test-meta-capi-token-abc123');
  vi.mocked(fetchWithRetry).mockClear();
});

function provider(overrides: Partial<TrackingProvider> = {}): TrackingProvider {
  return {
    id: 'tpr_meta',
    kind: 'meta',
    status: 'enabled',
    pixelId: '2179682406197934',
    capiToken: 'encrypted',
    capiTokenIv: null,
    capiTokenTag: null,
    testEventCode: 'TEST11989',
    customHead: null,
    customBody: null,
    config: {},
    enabledEvents: [],
    lastEventAt: null,
    errorCount24h: 0,
    lastError: null,
    createdAt: new Date('2026-05-16T10:00:00Z'),
    updatedAt: new Date('2026-05-16T10:00:00Z'),
    ...overrides,
  };
}

function ctx(overrides: Partial<DispatchContext> = {}): DispatchContext {
  return {
    eventName: 'purchase',
    eventId: 'evt_meta_dedup_1',
    receivedAt: new Date('2026-05-16T12:00:00Z'),
    pageRoute: '/merci',
    pageUrl: 'https://femiglow.ma/merci',
    pageTitle: 'Merci',
    referrer: '',
    anonymousId: 'anon_meta_123',
    sessionId: 'sess_meta_123',
    userId: 'user_42',
    consent: {
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      functional_storage: 'granted',
    },
    uaHash: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    ipAnonymized: '197.230.0.0',
    device: 'mobile',
    locale: 'fr-MA',
    params: {
      currency: 'MAD',
      value: 399,
      transaction_id: 'order-42',
      content_name: 'Kit FemiGlow',
      content_type: 'product',
      num_items: 1,
      items: [{ item_id: 'kit-1', item_category: 'beauty', price: 399, quantity: 1 }],
    },
    identity: {
      email: 'test@femiglow.ma',
      phone: '+212600000000',
      firstName: 'Sara',
      lastName: 'Test',
      city: 'Marrakech',
      country: 'MA',
    },
    externalId: 'user_42',
    fbp: 'fb.1.1684233600000.1234567890',
    fbc: 'fb.1.1684233600000.abcdefgh',
    attribution: {
      channel: 'meta',
      is_paid: true,
      strategy: 'last_paid_touch',
      reason: 'last_paid_touch',
      click_id: 'fb-click-1',
      click_id_field: 'fbc',
    },
    ...overrides,
  };
}

function lastCallBody(): Record<string, unknown> {
  const calls = vi.mocked(fetchWithRetry).mock.calls;
  return JSON.parse(calls[calls.length - 1][1].body as string);
}

describe('meta provider', () => {
  it('supports mapped events', () => {
    expect(metaAdapter.supports('purchase')).toBe(true);
    expect(metaAdapter.supports('page_view')).toBe(true);
    expect(metaAdapter.supports('add_to_cart')).toBe(true);
    expect(metaAdapter.supports('view_item')).toBe(true);
    expect(metaAdapter.supports('begin_checkout')).toBe(true);
    expect(metaAdapter.supports('generate_lead')).toBe(true);
    expect(metaAdapter.supports('sign_up')).toBe(true);
    expect(metaAdapter.supports('nonexistent_event')).toBe(false);
  });

  it('skips dispatch when provider is disabled', async () => {
    const result = await metaAdapter.dispatch(provider({ status: 'disabled' }), ctx());
    expect(result.status).toBe('skipped');
    expect(result.error).toBe('provider_disabled');
  });

  it('skips dispatch when pixelId is missing', async () => {
    const result = await metaAdapter.dispatch(provider({ pixelId: null }), ctx());
    expect(result.status).toBe('skipped');
    expect(result.error).toBe('pixel_id_missing');
  });

  it('skips dispatch when capiToken is missing', async () => {
    vi.mocked(decryptCapiToken).mockReturnValueOnce(null);
    const result = await metaAdapter.dispatch(provider(), ctx());
    expect(result.status).toBe('skipped');
    expect(result.error).toBe('capi_token_missing');
  });

  it('sends correct payload to Meta Graph API for purchase', async () => {
    const result = await metaAdapter.dispatch(provider(), ctx());

    expect(result.status).toBe('sent');
    expect(result.httpStatus).toBe(200);

    expect(vi.mocked(fetchWithRetry)).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetchWithRetry).mock.calls[0];
    expect(url).toContain('graph.facebook.com/v19.0/2179682406197934/events');
    expect(url).toContain('access_token=test-meta-capi-token-abc123');

    const body = JSON.parse(init.body as string);
    expect(body.data).toHaveLength(1);
    expect(body.test_event_code).toBe('TEST11989');

    const event = body.data[0];
    expect(event.event_name).toBe('Purchase');
    expect(event.event_id).toBe('evt_meta_dedup_1');
    expect(event.event_source_url).toBe('https://femiglow.ma/merci');
    expect(event.action_source).toBe('website');

    expect(event.user_data).toBeDefined();
    expect(event.user_data.external_id).toBeDefined();
    expect(event.user_data.client_ip_address).toBe('197.230.0.0');
    expect(event.user_data.fbp).toBe('fb.1.1684233600000.1234567890');
    expect(event.user_data.fbc).toBe('fb.1.1684233600000.abcdefgh');

    expect(event.custom_data).toBeDefined();
    expect(event.custom_data.currency).toBe('MAD');
    expect(event.custom_data.value).toBe(399);
    expect(event.custom_data.order_id).toBe('order-42');
  });

  it('maps items array to Meta contents format', async () => {
    await metaAdapter.dispatch(provider(), ctx());

    const customData = lastCallBody().data[0].custom_data as Record<string, unknown>;
    expect(customData.contents).toEqual([
      { id: 'kit-1', quantity: 1, item_price: 399 },
    ]);
    expect(customData.content_ids).toEqual(['kit-1']);
    expect(customData.content_type).toBe('product');
    expect(customData.num_items).toBe(1);
  });

  it('handles lead events with generate_lead mapping', async () => {
    await metaAdapter.dispatch(provider(), ctx({
      eventName: 'generate_lead',
      eventId: 'evt_lead_1',
      params: { content_name: 'Formulaire contact' },
    }));

    expect(lastCallBody().data[0].event_name).toBe('Lead');
  });

  it('handles add_to_cart event', async () => {
    await metaAdapter.dispatch(provider(), ctx({
      eventName: 'add_to_cart',
      eventId: 'evt_atc_1',
      params: {
        currency: 'MAD',
        value: 399,
        items: [{ item_id: 'kit-1', item_category: 'beauty', price: 399, quantity: 1 }],
      },
    }));

    expect(lastCallBody().data[0].event_name).toBe('AddToCart');
  });

  it('omits test_event_code when not set', async () => {
    await metaAdapter.dispatch(provider({ testEventCode: null }), ctx());

    expect(lastCallBody().test_event_code).toBeUndefined();
  });

  it('returns failed status on API error', async () => {
    vi.mocked(fetchWithRetry).mockResolvedValueOnce({
      ok: false,
      status: 400,
      body: '{"error":{"message":"Invalid token"}}',
      attempts: 1,
    });

    const result = await metaAdapter.dispatch(provider(), ctx());
    expect(result.status).toBe('failed');
    expect(result.httpStatus).toBe(400);
    expect(result.error).toContain('Invalid token');
  });

  it('returns client snippet with pixel ID', () => {
    const snippet = metaAdapter.clientSnippet!(provider());
    expect(snippet).toContain('2179682406197934');
    expect(snippet).toContain("fbq('init'");
    expect(snippet).toContain("fbq('track','PageView')");
  });

  it('returns null snippet for disabled provider', () => {
    expect(metaAdapter.clientSnippet!(provider({ status: 'disabled' }))).toBeNull();
    expect(metaAdapter.clientSnippet!(provider({ pixelId: null }))).toBeNull();
  });

  it('returns CSP hosts for Meta', () => {
    const hosts = metaAdapter.cspHosts();
    expect(hosts.scriptSrc).toContain('https://connect.facebook.net');
    expect(hosts.connectSrc).toContain('https://www.facebook.com');
    expect(hosts.connectSrc).toContain('https://graph.facebook.com');
  });
});