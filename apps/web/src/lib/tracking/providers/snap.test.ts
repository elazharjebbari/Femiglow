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
    expect(event.user_data.ct).toBe('Marrakech');
    expect(event.user_data.country).toBe('MA');
    expect(event.user_data.sc_click_id).toBe('snap-click-1');
    expect(event.custom_data).toMatchObject({
      event_id: 'evt_snap_dedup_1',
      currency: 'MAD',
      value: 399,
      order_id: 'order-42',
    });
    expect(event.custom_data.content_ids).toEqual(['kit-1']);
    expect(event.custom_data.content_category).toEqual(['beauty']);
    expect(event.custom_data.number_items).toEqual(['1']);
  });

  it('includes st (geo_region) from params', () => {
    const payload = __test__.buildPayload(provider(), ctx({
      params: { ...ctx().params, geo_region: 'Casablanca-Settat' },
    })) as any;
    expect(payload.data[0].user_data.st).toBe('Casablanca-Settat');
  });

  it('includes sc_cookie1 from params', () => {
    const payload = __test__.buildPayload(provider(), ctx({
      params: {
        sc_cookie1: 'snap_cookie_value_123',
      },
    })) as any;
    expect(payload.data[0].user_data.sc_cookie1).toBe('snap_cookie_value_123');
  });

  it('uses params.geo_region for st', () => {
    const payload = __test__.buildPayload(provider(), ctx({
      params: { ...ctx().params, geo_region: 'Marrakech-Safi' },
    })) as any;
    expect(payload.data[0].user_data.st).toBe('Marrakech-Safi');
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
    expect(snippet).toContain("window.__fg_snap_pixel_id='9bd26a82-3ecf-42aa-a3de-85df14c74a11'");
  });

  it('returns null for disabled provider', () => {
    expect(snapAdapter.clientSnippet!(provider({ status: 'disabled' }))).toBeNull();
  });

  it('returns null for provider without pixelId', () => {
    expect(snapAdapter.clientSnippet!(provider({ pixelId: null }))).toBeNull();
  });
});

// ─── Advanced Snap CAPI v3 format compliance tests ────────────────────

describe('snap CAPI v3 format compliance', () => {
  it('action_source est "website" (minuscules, pas "WEB")', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.data[0].action_source).toBe('website');
    expect(payload.data[0].action_source).not.toBe('WEB');
  });

  it('event_time est un timestamp Unix en secondes', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    const ts = payload.data[0].event_time;
    expect(typeof ts).toBe('number');
    expect(ts).toBe(Math.floor(new Date('2026-05-16T12:00:00Z').getTime() / 1000));
  });

  it('client_deduplication_id et uuid_c1 sont gérés côté client (SnapPixelEvents), pas CAPI', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.data[0].custom_data.client_deduplication_id).toBeUndefined();
    expect(payload.data[0].custom_data.uuid_c1).toBeUndefined();
  });

  it('user_data.em est toujours un array quand présent', () => {
    // Avec userData pré-hashé (hex sha256)
    const payload1 = __test__.buildPayload(provider(), ctx()) as any;
    expect(Array.isArray(payload1.data[0].user_data.em)).toBe(true);
    expect(payload1.data[0].user_data.em).toHaveLength(1);
    // Avec identity (server-side hash)
    const payload2 = __test__.buildPayload(provider(), ctx({
      identity: { email: 'test@femiglow.ma' },
      userData: undefined,
    })) as any;
    expect(Array.isArray(payload2.data[0].user_data.em)).toBe(true);
    expect(payload2.data[0].user_data.em[0]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('user_data.ph est toujours un array quand présent', () => {
    // Avec userData pré-hashé
    const payload1 = __test__.buildPayload(provider(), ctx()) as any;
    expect(Array.isArray(payload1.data[0].user_data.ph)).toBe(true);
    expect(payload1.data[0].user_data.ph).toHaveLength(1);
    // Avec identity (server-side hash)
    const payload2 = __test__.buildPayload(provider(), ctx({
      identity: { phone: '+212600000000' },
      userData: undefined,
    })) as any;
    expect(Array.isArray(payload2.data[0].user_data.ph)).toBe(true);
    expect(payload2.data[0].user_data.ph[0]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('les hashes identity correspondent à SHA-256(normalisé)', () => {
    const payload = __test__.buildPayload(provider(), ctx({
      identity: {
        email: 'Test@FemiGlow.MA',
        phone: '+212 6 00 00 00 00',
        firstName: '  Sara  ',
        lastName: 'El Amrani',
      },
      userData: undefined,
    })) as any;
    // L'email doit être normalisé (lowercase, trim) puis hashé
    const crypto = require('node:crypto');
    const expectedEmail = crypto.createHash('sha256').update('test@femiglow.ma').digest('hex');
    // Le téléphone est normalisé: digits only (+ retiré) → 212600000000
    const expectedPhone = crypto.createHash('sha256').update('212600000000').digest('hex');
    expect(payload.data[0].user_data.em[0]).toBe(expectedEmail);
    expect(payload.data[0].user_data.ph[0]).toBe(expectedPhone);
  });

  it('test_event_code est inclus uniquement quand présent', () => {
    const withCode = __test__.buildPayload(provider(), ctx()) as any;
    expect(withCode.test_event_code).toBe('SNAP-TEST-001');

    const withoutCode = __test__.buildPayload(provider({ testEventCode: null }), ctx()) as any;
    expect(withoutCode.test_event_code).toBeUndefined();
  });

  it('sc_click_id est résolu depuis attribution.click_id quand click_id_field est sccid/ScCid', () => {
    // sccid field
    const p1 = __test__.buildPayload(provider(), ctx({
      attribution: {
        channel: 'snap',
        is_paid: true,
        strategy: 'last_paid_touch',
        reason: 'last_paid_touch',
        click_id: 'snap-click-sccid',
        click_id_field: 'sccid',
      },
    })) as any;
    expect(p1.data[0].user_data.sc_click_id).toBe('snap-click-sccid');

    // ScCid field (variant capitalization)
    const p2 = __test__.buildPayload(provider(), ctx({
      attribution: {
        channel: 'snap',
        is_paid: true,
        strategy: 'last_paid_touch',
        reason: 'last_paid_touch',
        click_id: 'snap-click-sccid-alt',
        click_id_field: 'ScCid',
      },
    })) as any;
    expect(p2.data[0].user_data.sc_click_id).toBe('snap-click-sccid-alt');
  });

  it('sc_click_id peut aussi venir de params.sccid ou params.sc_click_id', () => {
    const p1 = __test__.buildPayload(provider(), ctx({
      params: { ...ctx().params, sccid: 'param-sccid-value' },
      attribution: undefined,
    })) as any;
    expect(p1.data[0].user_data.sc_click_id).toBe('param-sccid-value');

    const p2 = __test__.buildPayload(provider(), ctx({
      params: { ...ctx().params, sc_click_id: 'param-sc-click-value' },
      attribution: undefined,
    })) as any;
    expect(p2.data[0].user_data.sc_click_id).toBe('param-sc-click-value');
  });

  it('number_items est un array de strings représentant les quantités (Snap v3)', () => {
    const payload = __test__.buildPayload(provider(), ctx({
      params: {
        ...ctx().params,
        items: [
          { item_id: 'kit-1', item_category: 'beauty', price: 399, quantity: 2 },
          { item_id: 'kit-2', item_category: 'beauty', price: 199, quantity: 3 },
        ],
      },
    })) as any;
    expect(payload.data[0].custom_data.number_items).toEqual(['2', '3']);
  });

  it('payload sans identity ni userData : les champs hash sont undefined', () => {
    const payload = __test__.buildPayload(provider(), ctx({
      identity: undefined,
      userData: undefined,
    })) as any;
    const ud = payload.data[0].user_data;
    expect(ud.em).toBeUndefined();
    expect(ud.ph).toBeUndefined();
    expect(ud.fn).toBeUndefined();
    expect(ud.ln).toBeUndefined();
  });

  it('geo_city et geo_country sont hashés quand identity les fournit en texte brut', () => {
    const crypto = require('node:crypto');
    // identity.city/country → hashIdentity hashes them → hashed.ct / hashed.country
    const p1 = __test__.buildPayload(provider(), ctx({
      identity: { city: 'Rabat', country: 'MA' },
      userData: undefined,
    })) as any;
    // hashIdentity normalizes and hashes: city → sha256('rabat'), country → sha256('ma')
    expect(p1.data[0].user_data.ct).toMatch(/^[a-f0-9]{64}$/);
    expect(p1.data[0].user_data.country).toMatch(/^[a-f0-9]{64}$/);

    // address.city (plain text) fallback quand identity absent
    const p2 = __test__.buildPayload(provider(), ctx({
      identity: undefined,
      userData: {
        sha256_email_address: 'e'.repeat(64),
        address: { city: 'Marrakech', country: 'MA' },
      },
    })) as any;
    expect(p2.data[0].user_data.ct).toBe('Marrakech');
    expect(p2.data[0].user_data.country).toBe('MA');
  });
});

// ─── Snap event mapping coverage (all mapped events) ─────────────────

describe('snap event mapping coverage', () => {
  const SNAP_MAPPED_EVENTS: Record<string, string> = {
    page_view: 'PAGE_VIEW',
    view_item: 'VIEW_CONTENT',
    add_to_cart: 'ADD_CART',
    checkout_intent: 'START_CHECKOUT',
    begin_checkout: 'START_CHECKOUT',
    add_payment_info: 'ADD_BILLING',
    purchase: 'PURCHASE',
    generate_lead: 'LEAD',
    lead_capture: 'LEAD',
    chat_lead_form_submit: 'LEAD',
    sign_up: 'SIGN_UP',
  };

  for (const [fgEvent, expectedSnapName] of Object.entries(SNAP_MAPPED_EVENTS)) {
    it(`${fgEvent} → ${expectedSnapName}`, () => {
      const payload = __test__.buildPayload(provider(), ctx({ eventName: fgEvent })) as any;
      expect(payload.data[0].event_name).toBe(expectedSnapName);
    });
  }

  it('les événements non mappés pour Snap retournent CUSTOM_EVENT en fallback', () => {
    const payload = __test__.buildPayload(provider(), ctx({ eventName: 'scroll_depth' })) as any;
    expect(payload.data[0].event_name).toBe('CUSTOM_EVENT');
  });

  it('PURCHASE inclut order_id et number_items (CAPI v3)', () => {
    const payload = __test__.buildPayload(provider(), ctx({ eventName: 'purchase' })) as any;
    expect(payload.data[0].custom_data.order_id).toBe('order-42');
    expect(payload.data[0].custom_data.number_items).toEqual(['1']);
    // CAPI v3: payment_info_available and delivery_method are client-side only
    expect(payload.data[0].custom_data.payment_info_available).toBeUndefined();
    expect(payload.data[0].custom_data.delivery_method).toBeUndefined();
  });

  it('START_CHECKOUT inclut order_id et number_items (CAPI v3)', () => {
    const payload = __test__.buildPayload(provider(), ctx({ eventName: 'checkout_intent' })) as any;
    expect(payload.data[0].event_name).toBe('START_CHECKOUT');
    expect(payload.data[0].custom_data.order_id).toBe('order-42');
    expect(payload.data[0].custom_data.number_items).toEqual(['1']);
    expect(payload.data[0].custom_data.payment_info_available).toBeUndefined();
  });

  it('ADD_BILLING CAPI ne contient pas sign_up_method (client-side only)', () => {
    const payload = __test__.buildPayload(provider(), ctx({ eventName: 'add_payment_info' })) as any;
    expect(payload.data[0].event_name).toBe('ADD_BILLING');
    expect(payload.data[0].custom_data.sign_up_method).toBeUndefined();
  });

  it('VIEW_CONTENT CAPI ne contient pas number_items (CAPI v3)', () => {
    const payload = __test__.buildPayload(provider(), ctx({ eventName: 'view_item' })) as any;
    expect(payload.data[0].custom_data.number_items).toBeUndefined();
    expect(payload.data[0].custom_data.order_id).toBe('order-42');
  });

  it('ADD_CART CAPI contient number_items mais pas order_id', () => {
    const payload = __test__.buildPayload(provider(), ctx({ eventName: 'add_to_cart' })) as any;
    expect(payload.data[0].custom_data.number_items).toEqual(['1']);
    expect(payload.data[0].custom_data.order_id).toBeUndefined();
  });

  it('PAGE_VIEW CAPI est minimal (event_id, content_ids, content_category)', () => {
    const payload = __test__.buildPayload(provider(), ctx({ eventName: 'page_view' })) as any;
    expect(payload.data[0].custom_data.event_id).toBe('evt_snap_dedup_1');
    expect(payload.data[0].custom_data.number_items).toBeUndefined();
    expect(payload.data[0].custom_data.order_id).toBeUndefined();
  });

  it('custom_data.content_ids remplace item_ids (Snap v3)', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.data[0].custom_data.content_ids).toEqual(['kit-1']);
    expect(payload.data[0].custom_data.item_ids).toBeUndefined();
  });

  it('custom_data.content_category est un array (Snap v3)', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.data[0].custom_data.content_category).toEqual(['beauty']);
    expect(payload.data[0].custom_data.item_category).toBeUndefined();
  });

  it('custom_data.event_id est présent (Snap v3 dedup)', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.data[0].custom_data.event_id).toBe('evt_snap_dedup_1');
  });

  it('userAgent en clair est passé dans client_user_agent quand disponible', () => {
    const payload = __test__.buildPayload(provider(), ctx({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    })) as any;
    expect(payload.data[0].user_data.client_user_agent).toBe('Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)');
  });

  it('userAgent absent: fallback sur uaHash', () => {
    const payload = __test__.buildPayload(provider(), ctx()) as any;
    expect(payload.data[0].user_data.client_user_agent).toBe('ua_hash');
  });
});