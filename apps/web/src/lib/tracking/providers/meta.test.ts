import { beforeEach, describe, expect, it, vi } from 'vitest';

<<<<<<< HEAD
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
=======
vi.mock('@/lib/db/queries/tracking/providers', () => ({
  decryptCapiToken: vi.fn(() => 'decrypted_token'),
}));

vi.mock('./_enrich-purchase', () => ({
  enrichPurchase: vi.fn(),
}));

vi.mock('./retry', () => ({
  fetchWithRetry: vi.fn(),
}));

vi.mock('./event-mapping', () => ({
  isEventSupported: vi.fn(() => true),
}));

vi.mock('./get-mapped-name', () => ({
  getMappedName: vi.fn((ctx: { eventName: string }) => {
    const map: Record<string, string> = {
      purchase: 'Purchase',
      purchase_server: 'Purchase',
      view_item: 'ViewContent',
      add_to_cart: 'AddToCart',
    };
    return map[ctx.eventName] ?? null;
  }),
  isMetaCustomEvent: vi.fn(() => false),
}));

import type { TrackingProvider } from '@/lib/db/types';
import { metaAdapter } from './meta';
import { enrichPurchase } from './_enrich-purchase';
import { fetchWithRetry } from './retry';
import type { DispatchContext } from './types';

const enrichMock = vi.mocked(enrichPurchase);
const fetchMock = vi.mocked(fetchWithRetry);
>>>>>>> 0207ab8 (feat(tracking): guard meta dispatch on purchase missing value/currency)

function provider(overrides: Partial<TrackingProvider> = {}): TrackingProvider {
  return {
    id: 'tpr_meta',
    kind: 'meta',
    status: 'enabled',
<<<<<<< HEAD
    pixelId: '2179682406197934',
    capiToken: 'encrypted',
    capiTokenIv: null,
    capiTokenTag: null,
    testEventCode: 'TEST11989',
=======
    pixelId: '1234567890',
    capiToken: 'encrypted_token',
    capiTokenIv: null,
    capiTokenTag: null,
    testEventCode: null,
>>>>>>> 0207ab8 (feat(tracking): guard meta dispatch on purchase missing value/currency)
    customHead: null,
    customBody: null,
    config: {},
    enabledEvents: [],
    lastEventAt: null,
    errorCount24h: 0,
    lastError: null,
<<<<<<< HEAD
    createdAt: new Date('2026-05-16T10:00:00Z'),
    updatedAt: new Date('2026-05-16T10:00:00Z'),
=======
    createdAt: new Date('2026-05-20T10:00:00Z'),
    updatedAt: new Date('2026-05-20T10:00:00Z'),
>>>>>>> 0207ab8 (feat(tracking): guard meta dispatch on purchase missing value/currency)
    ...overrides,
  };
}

function ctx(overrides: Partial<DispatchContext> = {}): DispatchContext {
  return {
    eventName: 'purchase',
<<<<<<< HEAD
    eventId: 'evt_meta_dedup_1',
    receivedAt: new Date('2026-05-16T12:00:00Z'),
=======
    eventId: 'evt_meta_001',
    receivedAt: new Date('2026-05-20T12:00:00Z'),
>>>>>>> 0207ab8 (feat(tracking): guard meta dispatch on purchase missing value/currency)
    pageRoute: '/merci',
    pageUrl: 'https://femiglow.ma/merci',
    pageTitle: 'Merci',
    referrer: '',
<<<<<<< HEAD
    anonymousId: 'anon_meta_123',
    sessionId: 'sess_meta_123',
    userId: 'user_42',
=======
    anonymousId: 'anon_meta_1',
    sessionId: 'sess_meta_1',
    userId: null,
>>>>>>> 0207ab8 (feat(tracking): guard meta dispatch on purchase missing value/currency)
    consent: {
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      functional_storage: 'granted',
    },
<<<<<<< HEAD
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
=======
    uaHash: 'ua_hash_meta',
    ipAnonymized: '197.230.0.0',
    device: 'desktop',
    locale: 'fr-MA',
    params: { transaction_id: 'ord_001', value: 320, currency: 'MAD' },
    fbp: 'fb.1.aaa',
    fbc: 'fb.1.bbb',
>>>>>>> 0207ab8 (feat(tracking): guard meta dispatch on purchase missing value/currency)
    ...overrides,
  };
}

<<<<<<< HEAD
/**
 * Body de la dernière requête envoyée à Meta CAPI via `fetchWithRetry`.
 * Typage strict du retour pour éviter `unknown` à chaque déréférencement
 * `body.data[0]...` dans les tests appelants.
 */
interface MetaCapiBody {
  data: Array<Record<string, unknown>>;
  test_event_code?: string;
  [key: string]: unknown;
}

function lastCallBody(): MetaCapiBody {
  const calls = vi.mocked(fetchWithRetry).mock.calls;
  const last = calls[calls.length - 1];
  if (!last) throw new Error('fetchWithRetry was not called');
  const [, init] = last;
  return JSON.parse(init.body as string) as MetaCapiBody;
}

/**
 * Premier event du dernier body envoyé. Asserte la présence et garantit
 * un type non-undefined aux appelants — élimine le besoin d'optional
 * chaining ou non-null assertions à chaque déréférencement de `data[0]`.
 */
function firstEvent(): Record<string, unknown> {
  const body = lastCallBody();
  const event = body.data[0];
  if (!event) throw new Error('Meta CAPI body has no event in data[0]');
  return event;
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
=======
function okFetch(): void {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    body: '{"events_received":1}',
    attempts: 1,
    durationMs: 50,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default enrich path : params already valid → source=params
  enrichMock.mockResolvedValue({ value: 320, currency: 'MAD', source: 'params' });
  okFetch();
});

describe('metaAdapter.dispatch — provider guards (legacy)', () => {
  it('skips when provider disabled', async () => {
    const result = await metaAdapter.dispatch(provider({ status: 'disabled' }), ctx());
    expect(result.status).toBe('skipped');
    expect(result.error).toBe('provider_disabled');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips when pixelId missing', async () => {
>>>>>>> 0207ab8 (feat(tracking): guard meta dispatch on purchase missing value/currency)
    const result = await metaAdapter.dispatch(provider({ pixelId: null }), ctx());
    expect(result.status).toBe('skipped');
    expect(result.error).toBe('pixel_id_missing');
  });
<<<<<<< HEAD

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
    const firstCall = vi.mocked(fetchWithRetry).mock.calls[0];
    if (!firstCall) throw new Error('fetchWithRetry was not called');
    const [url, init] = firstCall;
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

    const customData = firstEvent().custom_data as Record<string, unknown>;
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

    expect(firstEvent().event_name).toBe('Lead');
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

    expect(firstEvent().event_name).toBe('AddToCart');
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
      durationMs: 0,
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
=======
});

describe('metaAdapter.dispatch — Purchase guard', () => {
  it('dispatches when params already have valid value+currency', async () => {
    const result = await metaAdapter.dispatch(provider(), ctx());
    expect(result.status).toBe('sent');
    expect(enrichMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      data: Array<{ custom_data: { value: number; currency: string } }>;
    };
    expect(body.data[0]!.custom_data.value).toBe(320);
    expect(body.data[0]!.custom_data.currency).toBe('MAD');
  });

  it('skips with purchase_value_currency_invalid when enrich returns unavailable', async () => {
    enrichMock.mockResolvedValue({ source: 'unavailable' });
    const result = await metaAdapter.dispatch(
      provider(),
      ctx({ params: { transaction_id: 'ord_unknown' } }),
    );
    expect(result.status).toBe('skipped');
    expect(result.error).toBe('purchase_value_currency_invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses DB-enriched value/currency when params are incomplete', async () => {
    enrichMock.mockResolvedValue({ value: 250, currency: 'USD', source: 'db' });
    const result = await metaAdapter.dispatch(
      provider(),
      ctx({ params: { transaction_id: 'ord_db_only' } }),
    );
    expect(result.status).toBe('sent');
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      data: Array<{ custom_data: { value: number; currency: string } }>;
    };
    expect(body.data[0]!.custom_data.value).toBe(250);
    expect(body.data[0]!.custom_data.currency).toBe('USD');
  });

  it('also guards the purchase_server event (Stripe webhook)', async () => {
    enrichMock.mockResolvedValue({ source: 'unavailable' });
    const result = await metaAdapter.dispatch(
      provider(),
      ctx({ eventName: 'purchase_server', params: { payment_intent_id: 'pi_xxx' } }),
    );
    expect(result.status).toBe('skipped');
    expect(result.error).toBe('purchase_value_currency_invalid');
  });

  it('does NOT call enrich for non-purchase events', async () => {
    const result = await metaAdapter.dispatch(
      provider(),
      ctx({ eventName: 'view_item', params: { value: 320, currency: 'MAD' } }),
    );
    expect(result.status).toBe('sent');
    expect(enrichMock).not.toHaveBeenCalled();
  });

  it('preserves the original ctx.params (no mutation)', async () => {
    enrichMock.mockResolvedValue({ value: 250, currency: 'USD', source: 'db' });
    const original = { transaction_id: 'ord_x' };
    const c = ctx({ params: original });
    await metaAdapter.dispatch(provider(), c);
    expect(c.params).toBe(original);
    expect(c.params).toEqual({ transaction_id: 'ord_x' });
  });
});

describe('metaAdapter.dispatch — payload shape', () => {
  it('produces a valid CAPI v19 payload', async () => {
    await metaAdapter.dispatch(provider(), ctx());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('graph.facebook.com/v19.0/'),
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      data: Array<{ event_name: string; event_id: string; action_source: string }>;
    };
    expect(body.data[0]).toMatchObject({
      event_name: 'Purchase',
      event_id: 'evt_meta_001',
      action_source: 'website',
    });
  });

  it('includes test_event_code when provider has one', async () => {
    await metaAdapter.dispatch(provider({ testEventCode: 'TEST42' }), ctx());
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      test_event_code?: string;
    };
    expect(body.test_event_code).toBe('TEST42');
  });

  it('reports failed when fetch returns non-ok', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      body: '{"error":{"message":"bad request"}}',
      attempts: 3,
      durationMs: 600,
    });
    const result = await metaAdapter.dispatch(provider(), ctx());
    expect(result.status).toBe('failed');
    expect(result.httpStatus).toBe(400);
    expect(result.error).toContain('bad request');
  });
});
>>>>>>> 0207ab8 (feat(tracking): guard meta dispatch on purchase missing value/currency)
