import { describe, expect, it } from 'vitest';

import type { TrackingProvider } from '@/lib/db/types';
import type { DispatchContext } from './types';
import { __test__ } from './snap';
import { snapAdapter } from './snap';

function provider(overrides: Partial<TrackingProvider> = {}): TrackingProvider {
  return {
    id: 'tpr_snap',
    kind: 'snap',
    status: 'enabled',
    pixelId: '9bd26a82-3ecf-42aa-a3de-85df14c74a11',
    capiToken: 'encrypted',
    capiTokenIv: null,
    capiTokenTag: null,
    testEventCode: 'SNAP-TEST-001',
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
    eventId: 'evt_snap_dedup_1',
    receivedAt: new Date('2026-05-16T12:00:00Z'),
    pageRoute: '/merci',
    pageUrl: 'https://femiglow.ma/merci',
    pageTitle: 'Merci',
    referrer: '',
    anonymousId: 'anon_123',
    sessionId: 'sess_123',
    userId: null,
    consent: {
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      functional_storage: 'granted',
    },
    uaHash: 'ua_hash',
    ipAnonymized: '197.230.0.0',
    device: 'mobile',
    locale: 'fr-MA',
    params: {
      currency: 'MAD',
      value: 399,
      transaction_id: 'order-42',
      event_tag: 'femiglow',
      description: 'Kit FemiGlow',
      items: [{ item_id: 'kit-1', item_category: 'beauty', price: 399, quantity: 1 }],
    },
    userData: {
      sha256_email_address: 'e'.repeat(64),
      sha256_phone_number: 'p'.repeat(64),
      address: {
        sha256_first_name: 'f'.repeat(64),
        city: 'Marrakech',
        country: 'MA',
      },
    },
    attribution: {
      channel: 'snap',
      is_paid: true,
      strategy: 'last_paid_touch',
      reason: 'last_paid_touch',
      click_id: 'snap-click-1',
      click_id_field: 'sccid',
    },
    ...overrides,
  };
}

describe('snap provider payload', () => {
  it('builds a complete CAPI payload with identity, dedup and ecommerce data', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.test_event_code).toBe('SNAP-TEST-001');
    expect(payload.data).toHaveLength(1);
    const event = payload.data[0];
    expect(event).toMatchObject({
      event_name: 'PURCHASE',
      event_id: 'evt_snap_dedup_1',
      event_source_url: 'https://femiglow.ma/merci',
      action_source: 'website',
    });
    expect(event.user_data.em).toEqual(['e'.repeat(64)]);
    expect(event.user_data.ph).toEqual(['p'.repeat(64)]);
    expect(event.user_data.geo_city).toBe('Marrakech');
    expect(event.user_data.geo_country).toBe('MA');
    expect(event.user_data.sc_click_id).toBe('snap-click-1');
    expect(event.custom_data).toMatchObject({
      currency: 'MAD',
      value: 399,
      transaction_id: 'order-42',
      client_deduplication_id: 'evt_snap_dedup_1',
      event_tag: 'femiglow',
      description: 'Kit FemiGlow',
      uuid_c1: 'anon_123',
      item_category: 'beauty',
    });
    expect(event.custom_data.item_ids).toEqual(['kit-1']);
  });

  it('includes geo_region from params', () => {
    const payload = __test__.buildPayload(provider(), ctx({
      params: { ...ctx().params, geo_region: 'Casablanca-Settat' },
    })) as any;
    expect(payload.data[0].user_data.geo_region).toBe('Casablanca-Settat');
  });

  it('includes sc_cookie1 from params', () => {
    const payload = __test__.buildPayload(provider(), ctx({
      params: {
        sc_cookie1: 'snap_cookie_value_123',
      },
    })) as any;
    expect(payload.data[0].user_data.sc_cookie1).toBe('snap_cookie_value_123');
  });

  it('uses params.geo_region for geo_region', () => {
    const payload = __test__.buildPayload(provider(), ctx({
      params: { ...ctx().params, geo_region: 'Marrakech-Safi' },
    })) as any;
    expect(payload.data[0].user_data.geo_region).toBe('Marrakech-Safi');
  });

  it('uses server-side hashIdentity when userData is absent', () => {
    const payload = __test__.buildPayload(provider(), ctx({
      identity: { email: 'test@femiglow.ma', phone: '+212600000000' },
      userData: undefined,
    })) as any;
    const ud = payload.data[0].user_data;
    expect(ud.em).toBeDefined();
    expect(ud.em[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(ud.ph).toBeDefined();
    expect(ud.ph[0]).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('snap client snippet', () => {
  it('returns init snippet without PAGE_VIEW auto-track', () => {
    const snippet = snapAdapter.clientSnippet!(provider());
    expect(snippet).toContain("snaptr('init','9bd26a82-3ecf-42aa-a3de-85df14c74a11')");
    expect(snippet).not.toContain("snaptr('track','PAGE_VIEW')");
    expect(snippet).not.toContain("snaptr('track',\"PAGE_VIEW\")");
  });

  it('returns null for disabled provider', () => {
    expect(snapAdapter.clientSnippet!(provider({ status: 'disabled' }))).toBeNull();
  });

  it('returns null for provider without pixelId', () => {
    expect(snapAdapter.clientSnippet!(provider({ pixelId: null }))).toBeNull();
  });
});