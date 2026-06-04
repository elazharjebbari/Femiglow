/**
 * SPEC APRÈS-FIX — taxonomie à l'ingestion `POST /api/track` (A00, AN-03/04).
 *
 * Fix W-C : ajout des schémas `cta_click` / `cta_impression` + normalisation des
 * variantes héritées (`pack_cta_click` / `video_cta_click` /
 * `composition_post_cta_click` …) vers `cta_click` à l'ingestion (nom d'origine
 * conservé dans `payload._src_event`). Les clics CTA réels sont désormais
 * acceptés et stockés sous le nom canonique attendu par l'agrégation funnel/CTA.
 *
 * `address_completed` reste stocké VERBATIM (le mapping vers add_shipping se fait
 * en lecture, côté agrégation checkout — AN-04) ; `scroll_depth_50` reste inconnu
 * (le funnel n'en dépend plus grâce au modèle monotonic).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { server } from '@/test/msw/server';
import { POST } from '@/app/api/track/route';
import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import { clearDedupCache } from '@/lib/tracking/server/dedup';
import { getEventSchema } from '@/lib/tracking/schemas';
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

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    event: 'view_item',
    event_id: uuidv7(),
    timestamp: new Date('2026-06-04T10:00:00Z').toISOString(),
    schema_version: 1,
    consent: GRANTED,
    page: { url: 'https://femiglow.ma/kit', path: '/kit', title: 'Kit', referrer: '', locale: 'fr-MA' },
    user: { anonymous_id: 'aid_test_1234567890', session_id: 'sid_test_1234567890' },
    params: { currency: 'MAD', value: 320 },
    ...overrides,
  };
}

function buildRequest(body: unknown, ip = '203.0.113.50') {
  return new Request('http://localhost/api/track', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      'accept-language': 'fr-MA,fr;q=0.9',
    },
    body: JSON.stringify(body),
  });
}

describe('Taxonomy audit — AN-03 (clics CTA normalisés et acceptés)', () => {
  it('A00-I011 [AN-03] cta_click et cta_impression ont un schéma', () => {
    expect(getEventSchema('cta_click')).not.toBeNull();
    expect(getEventSchema('cta_impression')).not.toBeNull();
  });

  it('A00-I001/I012 [AN-03] pack_cta_click accepté, normalisé en cta_click + _src_event', async () => {
    const res = await POST(
      buildRequest({ events: [makeEvent({ event: 'pack_cta_click', params: { cta_intent: 'purchase' } })] }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toBe(1);
    expect(body.rejected).toBe(0);
    const stored = Array.from(memoryStore().trackingEventsLog.values())[0];
    expect(stored?.eventName).toBe('cta_click');
    expect((stored?.payload as Record<string, unknown>)?._src_event).toBe('pack_cta_click');
  });

  it('A00-I002 [AN-03] video_cta_click + composition_post_cta_click acceptés (rejected=0)', async () => {
    const res = await POST(
      buildRequest({
        events: [
          makeEvent({ event: 'video_cta_click', params: {} }),
          makeEvent({ event: 'composition_post_cta_click', params: {} }),
        ],
      }),
    );
    const body = await res.json();
    expect(body.accepted).toBe(2);
    expect(body.rejected).toBe(0);
    const names = Array.from(memoryStore().trackingEventsLog.values()).map((e) => e.eventName);
    expect(names.every((n) => n === 'cta_click')).toBe(true);
  });

  it('A00-I004 [AN-02] scroll_depth_50 reste inconnu (le funnel n’en dépend plus — monotonic)', async () => {
    expect(getEventSchema('scroll_depth_50')).toBeNull();
    const res = await POST(buildRequest({ events: [makeEvent({ event: 'scroll_depth_50', params: {} })] }));
    expect((await res.json()).rejected).toBe(1);
  });
});

describe('Taxonomy audit — events réels acceptés / stockés verbatim', () => {
  it('A00-I007 [AN-02] view_item accepté et stocké verbatim', async () => {
    const res = await POST(buildRequest({ events: [makeEvent({ event: 'view_item' })] }));
    expect((await res.json()).accepted).toBe(1);
    expect(Array.from(memoryStore().trackingEventsLog.values())[0]?.eventName).toBe('view_item');
  });

  it('A00-I008 [AN-02] begin_checkout accepté et is_conversion=true', async () => {
    const res = await POST(
      buildRequest({ events: [makeEvent({ event: 'begin_checkout', params: { currency: 'MAD', value: 320 } })] }),
    );
    expect((await res.json()).accepted).toBe(1);
    const stored = Array.from(memoryStore().trackingEventsLog.values())[0];
    expect(stored?.eventName).toBe('begin_checkout');
    expect(stored?.isConversion).toBe(true);
  });

  it('A00-I009 add_to_cart NON conversion ; begin_checkout/generate_lead/lead_capture OUI', async () => {
    const ev = (event: string, params: Record<string, unknown>) => makeEvent({ event, params });
    const lead = { form_id: 'wizard', form_mode: 'wizard_embed', step_name: 'lead', variant_key: null, schema_version: 'v1', method: 'wizard', contact_channels: ['phone'], currency: 'MAD' };
    const res = await POST(
      buildRequest({
        events: [
          ev('add_to_cart', { currency: 'MAD', value: 320 }),
          ev('begin_checkout', { currency: 'MAD', value: 320 }),
          ev('generate_lead', { currency: 'MAD' }),
          ev('lead_capture', lead),
        ],
      }),
    );
    expect((await res.json()).accepted).toBe(4);
    const byName = new Map(
      Array.from(memoryStore().trackingEventsLog.values()).map((e) => [e.eventName, e.isConversion]),
    );
    expect(byName.get('add_to_cart')).toBe(false);
    expect(byName.get('begin_checkout')).toBe(true);
    expect(byName.get('generate_lead')).toBe(true);
    expect(byName.get('lead_capture')).toBe(true);
  });

  it('A00-I010 [AN-04] address_completed stocké verbatim (mapping add_shipping en lecture)', async () => {
    const res = await POST(
      buildRequest({
        events: [makeEvent({ event: 'address_completed', params: { form_id: 'wizard', form_mode: 'wizard_embed', step_name: 'address', variant_key: null, schema_version: 'v1', currency: 'MAD' } })],
      }),
    );
    expect((await res.json()).accepted).toBe(1);
    const stored = Array.from(memoryStore().trackingEventsLog.values())[0];
    expect(stored?.eventName).toBe('address_completed');
  });

  it('A00-I006 [AN-01] page_view a un schéma et est accepté', async () => {
    expect(getEventSchema('page_view')).not.toBeNull();
    const res = await POST(buildRequest({ events: [makeEvent({ event: 'page_view', params: { page_path: '/kit' } })] }));
    expect((await res.json()).accepted).toBe(1);
  });

  it('batch mixte : view_item + pack_cta_click désormais TOUS deux acceptés', async () => {
    const res = await POST(
      buildRequest({
        events: [
          makeEvent({ event: 'view_item' }),
          makeEvent({ event: 'pack_cta_click', params: { cta_intent: 'purchase' } }),
        ],
      }),
    );
    const body = await res.json();
    expect(body.accepted).toBe(2);
    expect(body.rejected).toBe(0);
  });
});

describe('Taxonomy audit — reste (todo)', () => {
  it.todo('A00-I014 [AN-04] checkout_intent à ajouter à CONVERSION_EVENTS si émis (non émis en prod)');
});
