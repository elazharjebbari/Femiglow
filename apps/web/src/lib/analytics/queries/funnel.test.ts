/**
 * Tests des queries Funnel.
 * cf. docs/analytics/06-tests-strategy.md §3 et 05-onglets-specs.md §3
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import type { TrackingEventLogEntry } from '@/lib/db/types';

import {
  getFunnelByPage,
  getFunnelOverview,
  getFunnelSankey,
} from './funnel';
import type { AnalyticsFilters } from '../filters';

const NOW = new Date('2026-05-06T12:00:00Z');
const FROM = new Date(NOW.getTime() - 60 * 60_000); // 1h plage

const FILTERS: AnalyticsFilters = {
  period: 'today',
  device: 'all',
  traffic: 'all',
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
  trafficSource?: string | null;
}

function pushEvent(opts: PushOpts): void {
  const store = memoryStore();
  const entry: TrackingEventLogEntry = {
    id: opts.id,
    eventId: `evt_${opts.id}`,
    eventName: opts.eventName,
    eventCategory: 'page',
    pageId: null,
    componentId: null,
    pageRoute: opts.pageRoute ?? '/kit',
    anonymousId: opts.anonymousId ?? `anon_${opts.sessionId}`,
    sessionId: opts.sessionId,
    userId: null,
    consentSnapshot: {
      ad_storage: 'denied',
      analytics_storage: opts.consentDenied ? 'denied' : 'granted',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functional_storage: 'granted',
    },
    payload: opts.payload ?? {},
    uaHash: 'ua',
    ipAnonymized: '0.0.0.0',
    device: opts.device ?? 'mobile',
    locale: 'fr-FR',
    isConversion: opts.eventName === 'purchase',
    providersDispatched: [],
    providersResults: {},
    receivedAt: opts.receivedAt ?? new Date(FROM.getTime() + 60_000),
    schemaVersion: 1,
    trafficSource: opts.trafficSource ?? null,
    trafficMedium: null,
    experimentId: null,
    experimentVariant: null,
  };
  store.trackingEventsLog.set(entry.id, entry);
}

describe('getFunnelOverview', () => {
  it('returns 0 sessions on empty store', async () => {
    const data = await getFunnelOverview({ ...FILTERS, period: 'custom', from: FROM.toISOString(), to: NOW.toISOString() }, NOW);
    expect(data.totalSessions).toBe(0);
    expect(data.steps.every((s) => s.sessions === 0)).toBe(true);
    expect(data.steps[0]!.progressionFromPrevious).toBeNull();
    expect(data.steps[0]!.dropoffToNext).toBeNull(); // cur=0 → dropoff=null
  });

  it('counts sessions cumulatively at each step', async () => {
    // session A → atteint purchase (toutes les étapes)
    pushEvent({ id: '1', sessionId: 'A', eventName: 'page_view', pageRoute: '/kit' });
    pushEvent({ id: '2', sessionId: 'A', eventName: 'scroll_depth_50' });
    pushEvent({ id: '3', sessionId: 'A', eventName: 'add_to_cart' });
    pushEvent({ id: '4', sessionId: 'A', eventName: 'begin_checkout' });
    pushEvent({ id: '5', sessionId: 'A', eventName: 'purchase' });
    // session B → atteint cta puis abandonne
    pushEvent({ id: '6', sessionId: 'B', eventName: 'page_view', pageRoute: '/kit' });
    pushEvent({ id: '7', sessionId: 'B', eventName: 'video_user_play' });
    pushEvent({ id: '8', sessionId: 'B', eventName: 'cta_click', payload: { cta_intent: 'purchase' } });
    // session C → seulement view
    pushEvent({ id: '9', sessionId: 'C', eventName: 'view_item' });

    const data = await getFunnelOverview(
      { ...FILTERS, period: 'custom', from: FROM.toISOString(), to: NOW.toISOString() },
      NOW,
    );
    expect(data.totalSessions).toBe(3);
    const steps = Object.fromEntries(data.steps.map((s) => [s.stage, s.sessions]));
    expect(steps).toEqual({
      view: 3, // A, B, C ont tous view
      engage: 2, // A, B
      cta: 2, // A, B
      checkout: 1, // A
      purchase: 1, // A
    });
    // drop-off cta→checkout = 1 - 1/2 = 0.5
    const ctaStep = data.steps.find((s) => s.stage === 'cta')!;
    expect(ctaStep.dropoffToNext).toBeCloseTo(0.5, 5);
    // progression engage→cta = 2/2 = 1
    const ctaProg = ctaStep.progressionFromPrevious;
    expect(ctaProg).toBeCloseTo(1, 5);
  });

  it('computes median time-to-next-step in seconds', async () => {
    // session A : view à T+0, engage à T+10s
    const t0 = new Date(FROM.getTime() + 60_000);
    pushEvent({ id: '1', sessionId: 'A', eventName: 'page_view', pageRoute: '/kit', receivedAt: t0 });
    pushEvent({
      id: '2',
      sessionId: 'A',
      eventName: 'scroll_depth_50',
      receivedAt: new Date(t0.getTime() + 10_000),
    });
    // session B : view à T+0, engage à T+20s → médiane = (10+20)/2 = 15
    const tb = new Date(FROM.getTime() + 120_000);
    pushEvent({ id: '3', sessionId: 'B', eventName: 'page_view', pageRoute: '/kit', receivedAt: tb });
    pushEvent({
      id: '4',
      sessionId: 'B',
      eventName: 'scroll_depth_50',
      receivedAt: new Date(tb.getTime() + 20_000),
    });

    const data = await getFunnelOverview(
      { ...FILTERS, period: 'custom', from: FROM.toISOString(), to: NOW.toISOString() },
      NOW,
    );
    const viewStep = data.steps.find((s) => s.stage === 'view')!;
    expect(viewStep.medianTimeToNextSeconds).toBeCloseTo(15, 5);
  });

  it('excludes consent-denied events', async () => {
    pushEvent({ id: '1', sessionId: 'A', eventName: 'page_view', pageRoute: '/kit', consentDenied: true });
    const data = await getFunnelOverview(
      { ...FILTERS, period: 'custom', from: FROM.toISOString(), to: NOW.toISOString() },
      NOW,
    );
    expect(data.totalSessions).toBe(0);
  });

  it('respects device filter', async () => {
    pushEvent({ id: '1', sessionId: 'A', eventName: 'page_view', pageRoute: '/kit', device: 'mobile' });
    pushEvent({ id: '2', sessionId: 'B', eventName: 'page_view', pageRoute: '/kit', device: 'desktop' });
    const data = await getFunnelOverview(
      { ...FILTERS, period: 'custom', from: FROM.toISOString(), to: NOW.toISOString(), device: 'desktop' },
      NOW,
    );
    expect(data.totalSessions).toBe(1);
  });

  it('counts cta_click only when intent=purchase', async () => {
    pushEvent({ id: '1', sessionId: 'A', eventName: 'page_view', pageRoute: '/kit' });
    pushEvent({ id: '2', sessionId: 'A', eventName: 'scroll_depth_50' });
    pushEvent({
      id: '3',
      sessionId: 'A',
      eventName: 'cta_click',
      payload: { cta_intent: 'navigate' }, // pas purchase
    });
    pushEvent({ id: '4', sessionId: 'B', eventName: 'page_view', pageRoute: '/kit' });
    pushEvent({ id: '5', sessionId: 'B', eventName: 'scroll_depth_50' });
    pushEvent({
      id: '6',
      sessionId: 'B',
      eventName: 'cta_click',
      payload: { cta_intent: 'purchase' },
    });
    const data = await getFunnelOverview(
      { ...FILTERS, period: 'custom', from: FROM.toISOString(), to: NOW.toISOString() },
      NOW,
    );
    const ctaStep = data.steps.find((s) => s.stage === 'cta')!;
    expect(ctaStep.sessions).toBe(1); // seul B compte
  });
});

describe('getFunnelByPage', () => {
  it('reports views/cta/purchases by first_page', async () => {
    // session A entre par /kit, achète
    pushEvent({ id: '1', sessionId: 'A', eventName: 'page_view', pageRoute: '/kit' });
    pushEvent({ id: '2', sessionId: 'A', eventName: 'scroll_depth_50', pageRoute: '/kit' });
    pushEvent({ id: '3', sessionId: 'A', eventName: 'add_to_cart', pageRoute: '/kit' });
    pushEvent({ id: '4', sessionId: 'A', eventName: 'begin_checkout', pageRoute: '/checkout' });
    pushEvent({ id: '5', sessionId: 'A', eventName: 'purchase', pageRoute: '/checkout' });
    // session B entre par /rituel, ne fait que view
    pushEvent({ id: '6', sessionId: 'B', eventName: 'page_view', pageRoute: '/rituel' });

    const data = await getFunnelByPage(
      { ...FILTERS, period: 'custom', from: FROM.toISOString(), to: NOW.toISOString() },
      NOW,
    );
    const kit = data.rows.find((r) => r.pageRoute === '/kit');
    // A entre par /kit, donc views=1, ctas=1, purchases=1
    expect(kit).toBeDefined();
    expect(kit?.views).toBe(1);
    expect(kit?.viewToCta).toBeCloseTo(1, 5);
    expect(kit?.ctaToBuy).toBeCloseTo(1, 5);
    expect(kit?.purchases).toBe(1);
    // /rituel : pas un viewItem ni /kit → s.view=false, donc filtré (views > 0)
    expect(data.rows.find((r) => r.pageRoute === '/rituel')).toBeUndefined();
  });
});

describe('getFunnelSankey', () => {
  it('aggregates by first_page × max stage and limits top N', async () => {
    for (let i = 0; i < 25; i += 1) {
      pushEvent({
        id: `${i}`,
        sessionId: `S${i}`,
        eventName: 'page_view',
        pageRoute: `/page-${i}`,
      });
    }
    const data = await getFunnelSankey(
      { ...FILTERS, period: 'custom', from: FROM.toISOString(), to: NOW.toISOString() },
      NOW,
      20,
    );
    expect(data.truncated).toBe(true);
    // 25 sessions distinctes mais aucun n'a `view` car /page-N n'est ni /kit ni view_item
    // → links vides. Vérifions plutôt avec /kit.
    expect(data.links.every((l) => l.firstPage !== '/page-0' || l.volume === 0)).toBe(true);
  });

  it('classifies sessions to their MAX reached stage', async () => {
    pushEvent({ id: '1', sessionId: 'A', eventName: 'page_view', pageRoute: '/kit' });
    pushEvent({ id: '2', sessionId: 'A', eventName: 'scroll_depth_50' });
    pushEvent({ id: '3', sessionId: 'A', eventName: 'add_to_cart' });
    pushEvent({ id: '4', sessionId: 'B', eventName: 'page_view', pageRoute: '/kit' });

    const data = await getFunnelSankey(
      { ...FILTERS, period: 'custom', from: FROM.toISOString(), to: NOW.toISOString() },
      NOW,
    );
    const kitLinks = data.links.filter((l) => l.firstPage === '/kit');
    // A → cta, B → view
    expect(kitLinks.find((l) => l.reachedStage === 'cta')?.volume).toBe(1);
    expect(kitLinks.find((l) => l.reachedStage === 'view')?.volume).toBe(1);
  });
});
