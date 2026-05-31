/**
 * Tests `logEvent` — colonnes attribution persistées.
 *
 * Ce fichier existe spécifiquement pour combler le trou de tests
 * identifié par l'audit attribution (cause #1 silencieuse) : aucun test
 * n'asserait que `trafficSource` était bien persisté. Conséquence : la
 * colonne restait NULL en prod sans alerter.
 *
 * Référence : `docs/attribution-fix-2026-05/01-audit-baseline.md`.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { memoryStore } from '@/lib/db/client';
import { logEvent, listEvents, type LogEventInput } from './events-log';

function baseInput(overrides: Partial<LogEventInput> = {}): LogEventInput {
  return {
    id: 'tev_test_' + Math.random().toString(36).slice(2),
    eventId: 'evt_' + Math.random().toString(36).slice(2),
    eventName: 'page_view',
    eventCategory: 'page',
    pageId: null,
    componentId: null,
    pageRoute: '/kit',
    anonymousId: 'anon_test',
    sessionId: 'sess_test',
    userId: null,
    consentSnapshot: {
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      functional_storage: 'granted',
    },
    payload: {},
    uaHash: 'ua_hash',
    ipAnonymized: '0.0.0.0',
    device: 'mobile',
    locale: 'fr-MA',
    ...overrides,
  };
}

beforeEach(() => {
  // Clear memoryStore tracking events
  const store = memoryStore();
  store.trackingEventsLog.clear();
  store.trackingEventsLogOrder.length = 0;
});

describe('logEvent — colonnes attribution (Fix audit cause #1)', () => {
  it('persiste trafficSource quand fourni', async () => {
    await logEvent(baseInput({ trafficSource: 'paid_social', trafficMedium: 'cpc' }));
    const events = await listEvents({ limit: 1 });
    expect(events).toHaveLength(1);
    expect(events[0]!.trafficSource).toBe('paid_social');
    expect(events[0]!.trafficMedium).toBe('cpc');
  });

  it('persiste trafficSource = NULL quand absent (rétrocompat v1)', async () => {
    await logEvent(baseInput());
    const events = await listEvents({ limit: 1 });
    expect(events).toHaveLength(1);
    expect(events[0]!.trafficSource).toBe(null);
    expect(events[0]!.trafficMedium).toBe(null);
  });

  it('persiste tous les buckets sans casser', async () => {
    const buckets = [
      'direct',
      'organic_search',
      'paid_search',
      'organic_social',
      'paid_social',
      'email',
      'referral',
      'unknown',
    ];
    for (const bucket of buckets) {
      await logEvent(
        baseInput({
          id: `tev_${bucket}`,
          eventId: `evt_${bucket}`,
          trafficSource: bucket,
          trafficMedium: bucket === 'email' ? 'email' : 'cpc',
        }),
      );
    }
    const events = await listEvents({ limit: 20 });
    const persistedBuckets = events.map((e) => e.trafficSource).filter(Boolean);
    expect(persistedBuckets).toHaveLength(buckets.length);
    expect(new Set(persistedBuckets)).toEqual(new Set(buckets));
  });

  it('readback : rowToEntry expose trafficSource correctement', async () => {
    await logEvent(
      baseInput({
        trafficSource: 'paid_search',
        trafficMedium: 'cpc',
      }),
    );
    const events = await listEvents({ limit: 1 });
    expect(events[0]).toMatchObject({
      trafficSource: 'paid_search',
      trafficMedium: 'cpc',
    });
  });

  it('listEvents filtré par eventName retourne attribution intacte', async () => {
    await logEvent(
      baseInput({
        eventName: 'purchase',
        trafficSource: 'paid_social',
        trafficMedium: 'cpc',
      }),
    );
    await logEvent(
      baseInput({
        id: 'tev_page',
        eventId: 'evt_page',
        eventName: 'page_view',
        trafficSource: 'organic_search',
        trafficMedium: 'organic',
      }),
    );
    const purchases = await listEvents({ eventName: 'purchase' });
    expect(purchases).toHaveLength(1);
    expect(purchases[0]!.trafficSource).toBe('paid_social');

    const pages = await listEvents({ eventName: 'page_view' });
    expect(pages).toHaveLength(1);
    expect(pages[0]!.trafficSource).toBe('organic_search');
  });

  it('event sans attribution + event avec attribution dans le même batch → coexistent', async () => {
    await logEvent(baseInput({ id: 'tev_1', eventId: 'evt_1' }));
    await logEvent(
      baseInput({
        id: 'tev_2',
        eventId: 'evt_2',
        trafficSource: 'paid_social',
      }),
    );
    const events = await listEvents({ limit: 10 });
    expect(events).toHaveLength(2);
    const withAttr = events.find((e) => e.trafficSource === 'paid_social');
    const withoutAttr = events.find((e) => e.trafficSource === null);
    expect(withAttr).toBeDefined();
    expect(withoutAttr).toBeDefined();
  });
});
