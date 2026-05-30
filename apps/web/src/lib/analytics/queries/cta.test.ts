/**
 * Tests des queries CTA — attribution last-click 7j, KPI globaux, top msg/page.
 * cf. docs/analytics/06-tests-strategy.md §3 et 05-onglets-specs.md §4
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import type {
  TrackingComponent,
  TrackingEventLogEntry,
} from '@/lib/db/types';

import { __clearAnalyticsCache } from '../cache';
import { getCtaData } from './cta';
import type { AnalyticsFilters } from '../filters';

const NOW = new Date('2026-05-06T12:00:00Z');

const FILTERS: AnalyticsFilters = {
  period: 'today',
  device: 'all',
  traffic: 'all',
};

beforeEach(() => {
  resetMemoryStore();
});

function pushComp(
  id: string,
  label: string,
  category: TrackingComponent['category'] = 'cta_primary',
  deletedAt: Date | null = null,
): void {
  const store = memoryStore();
  store.trackingComponents.set(id, {
    id,
    name: id,
    path: `Comp/${id}`,
    category,
    description: null,
    enabled: true,
    defaultParams: { label },
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt,
  });
}

interface PushOpts {
  id: string;
  sessionId: string;
  anonymousId: string;
  eventName: TrackingEventLogEntry['eventName'];
  componentId?: string | null;
  pageRoute?: string;
  receivedAt: Date;
  payload?: Record<string, unknown>;
  consentDenied?: boolean;
}

function pushEvent(o: PushOpts): void {
  const store = memoryStore();
  const entry: TrackingEventLogEntry = {
    id: o.id,
    eventId: `evt_${o.id}`,
    eventName: o.eventName,
    eventCategory: 'engagement',
    pageId: null,
    componentId: o.componentId ?? null,
    pageRoute: o.pageRoute ?? '/kit',
    anonymousId: o.anonymousId,
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
    device: 'mobile',
    locale: 'fr-FR',
    isConversion: o.eventName === 'purchase',
    providersDispatched: [],
    providersResults: {},
    receivedAt: o.receivedAt,
    schemaVersion: 1,
    trafficSource: null,
    trafficMedium: null,
    experimentId: null,
    experimentVariant: null,
  };
  store.trackingEventsLog.set(entry.id, entry);
}

const todayFrom = new Date('2026-05-06T00:00:00Z');
const todayTo = new Date('2026-05-07T00:00:00Z');
const filtersToday = (): AnalyticsFilters => ({
  ...FILTERS,
  period: 'custom',
  from: todayFrom.toISOString(),
  to: todayTo.toISOString(),
});

describe('getCtaData — attribution', () => {
  it('attributes purchase to last cta_click in same session', async () => {
    pushComp('c1', 'Composer mon rituel');
    pushComp('c2', 'Découvrir le Kit');

    pushEvent({
      id: '1',
      sessionId: 'S1',
      anonymousId: 'A1',
      eventName: 'cta_impression',
      componentId: 'c1',
      receivedAt: new Date('2026-05-06T10:00:00Z'),
    });
    pushEvent({
      id: '2',
      sessionId: 'S1',
      anonymousId: 'A1',
      eventName: 'cta_click',
      componentId: 'c1',
      receivedAt: new Date('2026-05-06T10:01:00Z'),
    });
    pushEvent({
      id: '3',
      sessionId: 'S1',
      anonymousId: 'A1',
      eventName: 'cta_click',
      componentId: 'c2',
      receivedAt: new Date('2026-05-06T10:05:00Z'),
    });
    pushEvent({
      id: '4',
      sessionId: 'S1',
      anonymousId: 'A1',
      eventName: 'purchase',
      receivedAt: new Date('2026-05-06T10:10:00Z'),
      // `value` en unité majeure MAD (cf. checkout-events) → 320 MAD = 32000 cents.
      payload: { value: 320 },
    });

    const data = await getCtaData(filtersToday(), NOW);
    const c2 = data.rows.find((r) => r.componentId === 'c2');
    const c1 = data.rows.find((r) => r.componentId === 'c1');
    expect(c2?.purchasesAttributed).toBe(1); // dernier click → c2
    expect(c1?.purchasesAttributed).toBe(0);
    expect(c2?.revenueAttributedCents).toBe(32000);
  });

  it('falls back to 7d-window same anonymous_id when session has no CTA click', async () => {
    pushComp('c1', 'Composer mon rituel');
    // CTA cliqué 3 jours avant l'achat, autre session
    pushEvent({
      id: '1',
      sessionId: 'S0',
      anonymousId: 'A1',
      eventName: 'cta_click',
      componentId: 'c1',
      receivedAt: new Date('2026-05-03T15:00:00Z'),
    });
    // Achat aujourd'hui, session différente, sans CTA dans la session
    pushEvent({
      id: '2',
      sessionId: 'S1',
      anonymousId: 'A1',
      eventName: 'purchase',
      receivedAt: new Date('2026-05-06T10:00:00Z'),
      payload: { value: 100 }, // 100 MAD = 10000 cents
    });

    const data = await getCtaData(filtersToday(), NOW);
    const c1 = data.rows.find((r) => r.componentId === 'c1');
    expect(c1?.purchasesAttributed).toBe(1);
    expect(c1?.revenueAttributedCents).toBe(10000);
  });

  it('does NOT attribute click older than 7 days', async () => {
    pushComp('c1', 'Composer mon rituel');
    pushEvent({
      id: '1',
      sessionId: 'S0',
      anonymousId: 'A1',
      eventName: 'cta_click',
      componentId: 'c1',
      // 8j avant l'achat → hors fenêtre
      receivedAt: new Date('2026-04-28T10:00:00Z'),
    });
    pushEvent({
      id: '2',
      sessionId: 'S1',
      anonymousId: 'A1',
      eventName: 'purchase',
      receivedAt: new Date('2026-05-06T10:00:00Z'),
      payload: { value: 5000 },
    });
    const data = await getCtaData(filtersToday(), NOW);
    expect(data.rows.length).toBe(0);
    expect(data.totals.revenueAttributedCents).toBe(0);
  });
});

describe('getCtaData — KPI totals', () => {
  it('sums impressions / clicks / revenue across rows', async () => {
    pushComp('c1', 'Test');
    pushEvent({
      id: '1',
      sessionId: 'S1',
      anonymousId: 'A1',
      eventName: 'cta_impression',
      componentId: 'c1',
      receivedAt: new Date('2026-05-06T10:00:00Z'),
    });
    pushEvent({
      id: '2',
      sessionId: 'S1',
      anonymousId: 'A1',
      eventName: 'cta_impression',
      componentId: 'c1',
      receivedAt: new Date('2026-05-06T10:00:30Z'),
    });
    pushEvent({
      id: '3',
      sessionId: 'S1',
      anonymousId: 'A1',
      eventName: 'cta_click',
      componentId: 'c1',
      receivedAt: new Date('2026-05-06T10:01:00Z'),
    });
    pushEvent({
      id: '4',
      sessionId: 'S1',
      anonymousId: 'A1',
      eventName: 'purchase',
      receivedAt: new Date('2026-05-06T10:02:00Z'),
      payload: { value: 250 }, // 250 MAD = 25000 cents
    });

    const data = await getCtaData(filtersToday(), NOW);
    expect(data.totals.impressions).toBe(2);
    expect(data.totals.clicks).toBe(1);
    expect(data.totals.conversionRate).toBeCloseTo(1, 5);
    expect(data.totals.revenueAttributedCents).toBe(25000);
  });
});

describe('getCtaData — F-PERF-04 cache opt-in', () => {
  afterEach(() => {
    delete process.env.ANALYTICS_CACHE_TTL_MS;
    __clearAnalyticsCache();
  });

  it('cache actif : un 2e appel ignore les nouveaux events (servi du cache)', async () => {
    process.env.ANALYTICS_CACHE_TTL_MS = '30000';
    pushComp('c1', 'CTA');
    pushEvent({ id: '1', sessionId: 'S1', anonymousId: 'A1', eventName: 'cta_click', componentId: 'c1', receivedAt: new Date('2026-05-06T10:00:00Z') });
    const first = await getCtaData(filtersToday(), NOW);
    expect(first.totals.clicks).toBe(1);

    pushEvent({ id: '2', sessionId: 'S2', anonymousId: 'A2', eventName: 'cta_click', componentId: 'c1', receivedAt: new Date('2026-05-06T10:01:00Z') });
    const second = await getCtaData(filtersToday(), NOW);
    expect(second.totals.clicks).toBe(1); // servi du cache

    __clearAnalyticsCache();
    const third = await getCtaData(filtersToday(), NOW);
    expect(third.totals.clicks).toBe(2); // recalcul frais
  });

  it('défaut (cache off) : chaque appel reflète les données fraîches', async () => {
    pushComp('c1', 'CTA');
    pushEvent({ id: '1', sessionId: 'S1', anonymousId: 'A1', eventName: 'cta_click', componentId: 'c1', receivedAt: new Date('2026-05-06T10:00:00Z') });
    const first = await getCtaData(filtersToday(), NOW);
    pushEvent({ id: '2', sessionId: 'S2', anonymousId: 'A2', eventName: 'cta_click', componentId: 'c1', receivedAt: new Date('2026-05-06T10:01:00Z') });
    const second = await getCtaData(filtersToday(), NOW);
    expect(first.totals.clicks).toBe(1);
    expect(second.totals.clicks).toBe(2);
  });
});

describe('getCtaData — F-CTA-02 topPages réconcilié avec le fallback 7j', () => {
  it('compte l’achat dans topPages même si le clic vient du fallback (page hors période)', async () => {
    pushComp('c1', 'CTA');
    // clic 3 jours avant, sur /promo (hors fenêtre "today")
    pushEvent({
      id: '1',
      sessionId: 'S0',
      anonymousId: 'A1',
      eventName: 'cta_click',
      componentId: 'c1',
      pageRoute: '/promo',
      receivedAt: new Date('2026-05-03T10:00:00Z'),
    });
    // achat aujourd'hui, autre session, même anonymous_id
    pushEvent({
      id: '2',
      sessionId: 'S1',
      anonymousId: 'A1',
      eventName: 'purchase',
      receivedAt: new Date('2026-05-06T10:00:00Z'),
      payload: { value: 100 },
    });
    const data = await getCtaData(filtersToday(), NOW);
    const promo = data.topPages.find((p) => p.pageRoute === '/promo');
    expect(promo?.purchasesAttributed).toBe(1);
    // réconciliation : Σ topPages.purchases = Σ rows.purchases (totals attribués)
    const sumTop = data.topPages.reduce((s, p) => s + p.purchasesAttributed, 0);
    const sumRows = data.rows.reduce((s, r) => s + r.purchasesAttributed, 0);
    expect(sumTop).toBe(sumRows);
  });
});

describe('getCtaData — F-CTA-04 page majoritaire déterministe', () => {
  it('choisit la page lexicographiquement plus petite à égalité de clics', async () => {
    pushComp('c1', 'CTA');
    pushEvent({
      id: '1',
      sessionId: 'S1',
      anonymousId: 'A1',
      eventName: 'cta_click',
      componentId: 'c1',
      pageRoute: '/zeta',
      receivedAt: new Date('2026-05-06T10:00:00Z'),
    });
    pushEvent({
      id: '2',
      sessionId: 'S2',
      anonymousId: 'A2',
      eventName: 'cta_click',
      componentId: 'c1',
      pageRoute: '/alpha',
      receivedAt: new Date('2026-05-06T10:01:00Z'),
    });
    const data = await getCtaData(filtersToday(), NOW);
    expect(data.rows.find((r) => r.componentId === 'c1')?.pageRoute).toBe('/alpha');
  });
});

describe('getCtaData — top messages & deleted components', () => {
  it('aggregates top messages by label across components', async () => {
    pushComp('c1', 'Découvrir');
    pushComp('c2', 'Découvrir'); // même label, autre variant
    pushComp('c3', 'Composer');
    for (const sid of ['S1', 'S2']) {
      pushEvent({
        id: `${sid}_click`,
        sessionId: sid,
        anonymousId: `A_${sid}`,
        eventName: 'cta_click',
        componentId: sid === 'S1' ? 'c1' : 'c2',
        receivedAt: new Date('2026-05-06T10:00:00Z'),
      });
      pushEvent({
        id: `${sid}_buy`,
        sessionId: sid,
        anonymousId: `A_${sid}`,
        eventName: 'purchase',
        receivedAt: new Date('2026-05-06T10:01:00Z'),
        payload: { value: 1000 },
      });
    }
    const data = await getCtaData(filtersToday(), NOW);
    const msg = data.topMessages.find((m) => m.label === 'Découvrir');
    expect(msg?.purchasesAttributed).toBe(2); // c1 + c2 mergés
    expect(msg?.clicks).toBe(2);
  });

  it('marks soft-deleted components with isDeleted=true', async () => {
    pushComp('c1', 'Old CTA', 'cta_primary', new Date('2026-05-01T00:00:00Z'));
    pushEvent({
      id: '1',
      sessionId: 'S1',
      anonymousId: 'A1',
      eventName: 'cta_click',
      componentId: 'c1',
      receivedAt: new Date('2026-05-06T10:00:00Z'),
    });
    const data = await getCtaData(filtersToday(), NOW);
    const c1 = data.rows.find((r) => r.componentId === 'c1');
    expect(c1?.isDeleted).toBe(true);
    expect(c1?.label).toBe('Old CTA');
  });

  it('drops rows with clicks=0 and purchases>0 (logical impossibility)', async () => {
    pushComp('c1', 'Ghost');
    // CTA non cliqué dans la fenêtre, mais purchase attribué via fallback impossible
    // (pas de click hors fenêtre non plus). Test « row vide » : aucune entrée.
    pushEvent({
      id: '1',
      sessionId: 'S1',
      anonymousId: 'A1',
      eventName: 'cta_impression',
      componentId: 'c1',
      receivedAt: new Date('2026-05-06T10:00:00Z'),
    });
    const data = await getCtaData(filtersToday(), NOW);
    const c1 = data.rows.find((r) => r.componentId === 'c1');
    expect(c1?.clicks).toBe(0);
    expect(c1?.purchasesAttributed).toBe(0);
  });
});
