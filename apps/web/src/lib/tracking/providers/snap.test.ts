import { describe, expect, it } from 'vitest';

import type { TrackingProvider } from '@/lib/db/types';
import type { DispatchContext } from './types';
import { __test__ } from './snap';

function provider(overrides: Partial<TrackingProvider> = {}): TrackingProvider {
  return {
    id: 'tpr_snap',
    kind: 'snap',
    status: 'enabled',
    pixelId: '6a4f1a2b-1111-4444-9999-abcdefabcdef',
    capiToken: 'encrypted',
    capiTokenIv: null,
    capiTokenTag: null,
    testEventCode: 'TEST123',
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
    expect(payload.test_event_code).toBe('TEST123');
    expect(payload.data).toHaveLength(1);
    const event = payload.data[0];
    expect(event).toMatchObject({
      event_name: 'PURCHASE',
      event_id: 'evt_snap_dedup_1',
      event_source_url: 'https://femiglow.ma/merci',
      action_source: 'WEB',
    });
    expect(event.user_data.em).toEqual(['e'.repeat(64)]);
    expect(event.user_data.ph).toEqual(['p'.repeat(64)]);
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
});
