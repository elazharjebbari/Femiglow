/**
 * Tests des queries Checkout.
 * cf. docs/analytics/06-tests-strategy.md §3 et 05-onglets-specs.md §5
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import type { TrackingEventLogEntry } from '@/lib/db/types';

import { getCheckoutData } from './checkout';
import type { AnalyticsFilters } from '../filters';

const NOW = new Date('2026-05-06T12:00:00Z');
const FROM = new Date(NOW.getTime() - 2 * 60 * 60_000); // 2h plage

const FILTERS: AnalyticsFilters = {
  period: 'custom',
  device: 'all',
  traffic: 'all',
  from: FROM.toISOString(),
  to: NOW.toISOString(),
};

beforeEach(() => {
  resetMemoryStore();
});

interface PushOpts {
  id: string;
  sessionId: string;
  anonymousId?: string;
  eventName: TrackingEventLogEntry['eventName'];
  pageRoute?: string;
  receivedAt?: Date;
  payload?: Record<string, unknown>;
  device?: TrackingEventLogEntry['device'];
  consentDenied?: boolean;
}

function pushEvent(o: PushOpts): void {
  const store = memoryStore();
  const entry: TrackingEventLogEntry = {
    id: o.id,
    eventId: `evt_${o.id}`,
    eventName: o.eventName,
    eventCategory: 'ecommerce',
    pageId: null,
    componentId: null,
    pageRoute: o.pageRoute ?? '/checkout',
    anonymousId: o.anonymousId ?? `anon_${o.sessionId}`,
    sessionId: o.sessionId,
    userId: null,
    consentSnapshot: {
      ad_storage: 'denied',
      analytics_storage: o.consentDenied ? 'denied' : 'granted',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functional_storage: 'granted',
    },
    payload: o.payload ?? {},
    uaHash: 'ua',
    ipAnonymized: '0.0.0.0',
    device: o.device ?? 'mobile',
    locale: 'fr-FR',
    isConversion: o.eventName === 'purchase' || o.eventName === 'purchase_server',
    providersDispatched: [],
    providersResults: {},
    receivedAt: o.receivedAt ?? new Date(FROM.getTime() + 60_000),
    schemaVersion: 1,
    trafficSource: null,
    trafficMedium: null,
    experimentId: null,
    experimentVariant: null,
  };
  store.trackingEventsLog.set(entry.id, entry);
}

describe('getCheckoutData', () => {
  it('returns zero totals on empty store', async () => {
    const data = await getCheckoutData(FILTERS, NOW);
    expect(data.totals.viewCart).toBe(0);
    expect(data.totals.beginCheckout).toBe(0);
    expect(data.totals.submissions).toBe(0);
    expect(data.totals.abandons).toBe(0);
    expect(data.steps.every((s) => s.sessions === 0)).toBe(true);
    expect(data.timeToSubmit.sampleSize).toBe(0);
    expect(data.timeToSubmit.p50).toBeNull();
    expect(data.topErrors).toHaveLength(0);
    expect(data.topAbandonedFields).toHaveLength(0);
  });

  it('counts sessions cumulatively across the funnel', async () => {
    // Session A : full path
    pushEvent({ id: '1', sessionId: 'A', eventName: 'view_cart' });
    pushEvent({ id: '2', sessionId: 'A', eventName: 'begin_checkout' });
    pushEvent({ id: '3', sessionId: 'A', eventName: 'add_shipping_info' });
    pushEvent({ id: '4', sessionId: 'A', eventName: 'add_payment_info' });
    pushEvent({
      id: '5',
      sessionId: 'A',
      eventName: 'purchase',
      payload: { value: 4900 },
      receivedAt: new Date(FROM.getTime() + 240_000),
    });
    // Session B : commence le checkout, échoue (drop-off avant payment)
    pushEvent({ id: '6', sessionId: 'B', eventName: 'view_cart' });
    pushEvent({ id: '7', sessionId: 'B', eventName: 'begin_checkout' });
    pushEvent({ id: '8', sessionId: 'B', eventName: 'add_shipping_info' });
    // Session C : juste view_cart, pas de checkout
    pushEvent({ id: '9', sessionId: 'C', eventName: 'view_cart' });

    const data = await getCheckoutData(FILTERS, NOW);
    const counts = Object.fromEntries(
      data.steps.map((s) => [s.stage, s.sessions]),
    );
    expect(counts).toEqual({
      view_cart: 3,
      begin_checkout: 2,
      add_shipping: 2,
      add_payment: 1,
      submit: 1, // implicit du fait du purchase de A
      purchase: 1,
    });
    expect(data.totals.viewCart).toBe(3);
    expect(data.totals.beginCheckout).toBe(2);
    expect(data.totals.submissions).toBe(1);
    // B a démarré le checkout sans purchase → 1 abandon
    expect(data.totals.abandons).toBe(1);
  });

  it('flags purchase_server as server fallback in totals', async () => {
    pushEvent({ id: '1', sessionId: 'A', eventName: 'begin_checkout' });
    pushEvent({
      id: '2',
      sessionId: 'A',
      eventName: 'purchase_server',
      payload: { value: 4900 },
      receivedAt: new Date(FROM.getTime() + 120_000),
    });
    // Session B : purchase client classique
    pushEvent({ id: '3', sessionId: 'B', eventName: 'begin_checkout' });
    pushEvent({
      id: '4',
      sessionId: 'B',
      eventName: 'purchase',
      payload: { value: 4900 },
      receivedAt: new Date(FROM.getTime() + 120_000),
    });

    const data = await getCheckoutData(FILTERS, NOW);
    expect(data.totals.submissions).toBe(2); // les deux sessions comptent
    expect(data.totals.serverFallbackPurchases).toBe(1); // seul A
    expect(data.totals.abandons).toBe(0);
  });

  it('counts begin_checkout > 60min before purchase as abandon', async () => {
    pushEvent({
      id: '1',
      sessionId: 'A',
      eventName: 'begin_checkout',
      receivedAt: new Date(FROM.getTime() + 60_000),
    });
    // purchase 90 min plus tard → en dehors fenêtre
    pushEvent({
      id: '2',
      sessionId: 'A',
      eventName: 'purchase',
      payload: { value: 4900 },
      receivedAt: new Date(FROM.getTime() + 60_000 + 90 * 60_000),
    });

    // élargir filter pour capter le purchase
    const wide: AnalyticsFilters = {
      ...FILTERS,
      to: new Date(FROM.getTime() + 3 * 60 * 60_000).toISOString(),
    };
    const data = await getCheckoutData(wide, new Date(FROM.getTime() + 3 * 60 * 60_000));
    expect(data.totals.abandons).toBe(1);
    // La purchase est tout de même comptée dans submissions (elle a eu lieu).
    expect(data.totals.submissions).toBe(1);
  });

  it('computes time-to-submit histogram + percentiles, capped at 30min', async () => {
    // 5 sessions avec TTS : 30s, 90s, 200s, 400s, 60min (plafonné 30min)
    const baseStart = FROM.getTime() + 60_000;
    const cases: Array<[string, number]> = [
      ['A', 30],
      ['B', 90],
      ['C', 200],
      ['D', 400],
      ['E', 60 * 60], // sera plafonné à 30 min = 1800s
    ];
    let id = 1;
    for (const [sid, ttsSec] of cases) {
      pushEvent({
        id: String(id++),
        sessionId: sid,
        eventName: 'begin_checkout',
        receivedAt: new Date(baseStart),
      });
      pushEvent({
        id: String(id++),
        sessionId: sid,
        eventName: 'purchase',
        payload: { value: 4900 },
        receivedAt: new Date(baseStart + ttsSec * 1000),
      });
    }

    const wide: AnalyticsFilters = {
      ...FILTERS,
      to: new Date(FROM.getTime() + 3 * 60 * 60_000).toISOString(),
    };
    const data = await getCheckoutData(wide, new Date(FROM.getTime() + 3 * 60 * 60_000));
    expect(data.timeToSubmit.sampleSize).toBe(5);
    expect(data.timeToSubmit.p50).not.toBeNull();
    // 30s → bucket [0,50)
    expect(data.timeToSubmit.buckets[0]!.sessions).toBe(1);
    // 90s → bucket [50,100)
    expect(data.timeToSubmit.buckets[1]!.sessions).toBe(1);
    // 200s → bucket [200,250)
    expect(data.timeToSubmit.buckets[4]!.sessions).toBe(1);
    // 400s → bucket [400,450)
    expect(data.timeToSubmit.buckets[8]!.sessions).toBe(1);
    // 1800s plafond → bucket dernier [550,600)
    expect(data.timeToSubmit.buckets[11]!.sessions).toBe(1);
    // p50 = 200s (3e val ordonnée)
    expect(data.timeToSubmit.p50).toBe(200);
  });

  it('excludes sub-1s submissions (bot heuristic)', async () => {
    pushEvent({
      id: '1',
      sessionId: 'A',
      eventName: 'begin_checkout',
      receivedAt: new Date(FROM.getTime() + 60_000),
    });
    pushEvent({
      id: '2',
      sessionId: 'A',
      eventName: 'purchase',
      payload: { value: 4900 },
      // 0.5s après → bot, ignoré du TTS
      receivedAt: new Date(FROM.getTime() + 60_000 + 500),
    });

    const data = await getCheckoutData(FILTERS, NOW);
    expect(data.timeToSubmit.sampleSize).toBe(0);
    // mais la purchase compte toujours dans submissions
    expect(data.totals.submissions).toBe(1);
  });

  it('aggregates form_validation_error by (field_id, error_code)', async () => {
    // 3 erreurs sur email/required, 1 erreur sur address/required, 2 sur email/format.
    pushEvent({
      id: '1',
      sessionId: 'A',
      eventName: 'form_validation_error',
      payload: { field_id: 'email', error_code: 'required' },
    });
    pushEvent({
      id: '2',
      sessionId: 'A',
      eventName: 'form_validation_error',
      payload: { field_id: 'email', error_code: 'required' },
    });
    pushEvent({
      id: '3',
      sessionId: 'B',
      eventName: 'form_validation_error',
      payload: { field_id: 'email', error_code: 'required' },
    });
    pushEvent({
      id: '4',
      sessionId: 'B',
      eventName: 'form_validation_error',
      payload: { field_id: 'address', error_code: 'required' },
    });
    pushEvent({
      id: '5',
      sessionId: 'C',
      eventName: 'form_validation_error',
      payload: { field_id: 'email', error_code: 'format' },
    });
    pushEvent({
      id: '6',
      sessionId: 'C',
      eventName: 'form_validation_error',
      payload: { field_id: 'email', error_code: 'format' },
    });

    const data = await getCheckoutData(FILTERS, NOW);
    expect(data.topErrors).toHaveLength(3);
    expect(data.topErrors[0]).toEqual({
      fieldId: 'email',
      errorCode: 'required',
      occurrences: 3,
      affectedSessions: 2, // A + B
    });
    expect(data.topErrors[1]).toEqual({
      fieldId: 'email',
      errorCode: 'format',
      occurrences: 2,
      affectedSessions: 1,
    });
    expect(data.topErrors[2]).toEqual({
      fieldId: 'address',
      errorCode: 'required',
      occurrences: 1,
      affectedSessions: 1,
    });
  });

  it('aggregates form_abandon by last_field_id', async () => {
    pushEvent({
      id: '1',
      sessionId: 'A',
      eventName: 'form_abandon',
      payload: { last_field_id: 'card_number' },
    });
    pushEvent({
      id: '2',
      sessionId: 'B',
      eventName: 'form_abandon',
      payload: { last_field_id: 'card_number' },
    });
    pushEvent({
      id: '3',
      sessionId: 'C',
      eventName: 'form_abandon',
      payload: { last_field_id: 'cvc' },
    });

    const data = await getCheckoutData(FILTERS, NOW);
    expect(data.topAbandonedFields).toHaveLength(2);
    expect(data.topAbandonedFields[0]).toEqual({
      lastField: 'card_number',
      abandons: 2,
    });
    expect(data.topAbandonedFields[1]).toEqual({
      lastField: 'cvc',
      abandons: 1,
    });
  });

  it('excludes consent-denied events', async () => {
    pushEvent({
      id: '1',
      sessionId: 'A',
      eventName: 'view_cart',
      consentDenied: true,
    });
    pushEvent({ id: '2', sessionId: 'B', eventName: 'view_cart' });

    const data = await getCheckoutData(FILTERS, NOW);
    expect(data.totals.viewCart).toBe(1);
  });

  it('respects device filter', async () => {
    pushEvent({ id: '1', sessionId: 'A', eventName: 'view_cart', device: 'mobile' });
    pushEvent({ id: '2', sessionId: 'B', eventName: 'view_cart', device: 'desktop' });

    const data = await getCheckoutData(
      { ...FILTERS, device: 'mobile' },
      NOW,
    );
    expect(data.totals.viewCart).toBe(1);
  });
});
