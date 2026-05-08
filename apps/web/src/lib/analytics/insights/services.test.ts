import { beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { TrackingEventLogEntry } from '@/lib/db/types';
import { runInsightsRefresh } from './refresh';
import {
  getOverview,
  getPagesTop,
  getPageDetail,
  getComponentsTop,
  getComponentDetail,
  getDeadComponents,
  getSectionsTop,
  getFunnel,
} from './services';
import { DEFAULT_INSIGHTS_FILTERS } from './contracts';

const NOW = new Date('2026-05-08T12:00:00Z');

beforeEach(() => {
  resetMemoryStore();
});

function injectEvent(overrides: Partial<TrackingEventLogEntry> = {}): void {
  const id = overrides.id ?? createId('evt');
  memoryStore().trackingEventsLog.set(id, {
    id,
    eventId: id,
    eventName: 'page_view',
    eventCategory: 'page',
    pageId: null,
    componentId: null,
    pageRoute: '/',
    anonymousId: 'anon',
    sessionId: 'sess',
    userId: null,
    consentSnapshot: { analytics: true } as never,
    payload: {},
    uaHash: 'h',
    ipAnonymized: '0.0.0.0',
    device: 'mobile',
    locale: 'fr-MA',
    isConversion: false,
    providersDispatched: [],
    providersResults: {},
    receivedAt: NOW,
    schemaVersion: 1,
    trafficSource: null,
    trafficMedium: null,
    experimentId: null,
    experimentVariant: null,
    ...overrides,
  });
}

async function seedAndRefresh(): Promise<void> {
  injectEvent({ eventName: 'page_view', pageRoute: '/', sessionId: 'A' });
  injectEvent({ eventName: 'page_view', pageRoute: '/', sessionId: 'B' });
  injectEvent({ eventName: 'page_view', pageRoute: '/kit', sessionId: 'C' });
  injectEvent({ eventName: 'add_to_cart', componentId: 'cta-1', sessionId: 'A', pageRoute: '/' });
  injectEvent({ eventName: 'view_item', sessionId: 'A' });
  injectEvent({ eventName: 'purchase', sessionId: 'A', isConversion: true, payload: { value: 100 } });
  injectEvent({
    eventName: 'fg_section_view',
    pageRoute: '/kit',
    payload: { section_id: 'rituel' },
    sessionId: 'A',
  });
  injectEvent({
    eventName: 'fg_section_view',
    pageRoute: '/kit',
    payload: { section_id: 'rituel' },
    sessionId: 'B',
  });
  await runInsightsRefresh({ trigger: 'manual', actorId: 'adm_test' });
}

describe('getOverview', () => {
  it('renvoie firstRun=true sur table vide', async () => {
    const data = await getOverview(DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(data.firstRun).toBe(true);
    expect(data.kpis.totalEvents).toBe(0);
  });

  it('agrège les KPIs après refresh', async () => {
    await seedAndRefresh();
    const data = await getOverview(DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(data.firstRun).toBe(false);
    expect(data.kpis.totalEvents).toBe(8);
    expect(data.kpis.pageViews).toBe(3);
    expect(data.kpis.conversions).toBe(1);
  });

  it('timeseries couvre les jours de la fenêtre', async () => {
    await seedAndRefresh();
    const data = await getOverview(
      { ...DEFAULT_INSIGHTS_FILTERS, window: '7d' },
      NOW,
    );
    expect(data.timeseries.length).toBe(7);
    const today = data.timeseries.find((p) => p.date === '2026-05-08');
    expect(today?.events).toBeGreaterThan(0);
  });

  it('topEvents trié par count desc', async () => {
    await seedAndRefresh();
    const data = await getOverview(DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(data.topEvents[0]!.eventName).toBe('page_view');
  });

  it('isConversion flag sur events de funnel', async () => {
    await seedAndRefresh();
    const data = await getOverview(DEFAULT_INSIGHTS_FILTERS, NOW);
    const purchase = data.topEvents.find((e) => e.eventName === 'purchase');
    expect(purchase?.isConversion).toBe(true);
  });
});

describe('getPagesTop', () => {
  it('renvoie [] si rien', async () => {
    const data = await getPagesTop(DEFAULT_INSIGHTS_FILTERS, 30, NOW);
    expect(data.pages).toEqual([]);
  });

  it('trie par pageViews desc', async () => {
    await seedAndRefresh();
    const data = await getPagesTop(DEFAULT_INSIGHTS_FILTERS, 30, NOW);
    expect(data.pages[0]!.pageRoute).toBe('/');
    expect(data.pages[0]!.pageViews).toBe(2);
  });

  it('limit respecté', async () => {
    await seedAndRefresh();
    const data = await getPagesTop(DEFAULT_INSIGHTS_FILTERS, 1, NOW);
    expect(data.pages.length).toBe(1);
  });
});

describe('getPageDetail', () => {
  it('drill-down /kit renvoie events liés', async () => {
    await seedAndRefresh();
    const data = await getPageDetail('/kit', DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(data.pageRoute).toBe('/kit');
    expect(data.pageViews).toBe(1);
  });
});

describe('getComponentsTop', () => {
  it('renvoie composants triés par total', async () => {
    await seedAndRefresh();
    const data = await getComponentsTop(DEFAULT_INSIGHTS_FILTERS, 50, NOW);
    expect(data.components.length).toBe(1);
    expect(data.components[0]!.componentId).toBe('cta-1');
    expect(data.components[0]!.total).toBe(1);
  });
});

describe('getComponentDetail', () => {
  it('agrège events + pages pour un composant', async () => {
    await seedAndRefresh();
    const data = await getComponentDetail('cta-1', DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(data.total).toBe(1);
    expect(data.events[0]!.eventName).toBe('add_to_cart');
  });
});

describe('getDeadComponents', () => {
  it('liste les composants jamais déclencheurs', async () => {
    memoryStore().trackingComponents.set('cmp_X', {
      id: 'cmp_X',
      key: 'cmp_X',
      name: 'Mort',
      pageGroup: 'home',
    } as never);
    await seedAndRefresh();
    const data = await getDeadComponents(DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(data.components.find((c) => c.componentId === 'cmp_X')).toBeTruthy();
  });
});

describe('getSectionsTop', () => {
  it('agrège sections par durée moyenne', async () => {
    await seedAndRefresh();
    const data = await getSectionsTop(DEFAULT_INSIGHTS_FILTERS, 30, NOW);
    expect(data.sections.length).toBe(1);
    expect(data.sections[0]!.sectionId).toBe('rituel');
    expect(data.sections[0]!.views).toBe(2);
  });
});

describe('getFunnel', () => {
  it('renvoie 5 stages dans le bon ordre', async () => {
    await seedAndRefresh();
    const data = await getFunnel(DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(data.stages.map((s) => s.name)).toEqual([
      'view_item',
      'add_to_cart',
      'begin_checkout',
      'add_payment_info',
      'purchase',
    ]);
    expect(data.stages.find((s) => s.name === 'view_item')?.count).toBe(1);
    expect(data.stages.find((s) => s.name === 'purchase')?.count).toBe(1);
  });

  it('drop-offs : 4 transitions', async () => {
    await seedAndRefresh();
    const data = await getFunnel(DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(data.dropoffs.length).toBe(4);
    expect(data.dropoffs[0]!.fromStage).toBe('view_item');
    expect(data.dropoffs[0]!.toStage).toBe('add_to_cart');
  });

  it('totalRevenueCents calculé', async () => {
    await seedAndRefresh();
    const data = await getFunnel(DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(data.totalRevenueCents).toBe(10000);
  });
});

describe('services — variations vs période précédente', () => {
  it('variation positive si période actuelle > précédente', async () => {
    injectEvent({
      eventName: 'page_view',
      receivedAt: new Date('2026-04-30T10:00:00Z'),
    });
    for (let i = 0; i < 5; i++) {
      injectEvent({
        eventName: 'page_view',
        sessionId: `sess_${i}`,
        receivedAt: new Date('2026-05-07T10:00:00Z'),
      });
    }
    await runInsightsRefresh({ trigger: 'manual', actorId: null });
    const data = await getOverview(
      { ...DEFAULT_INSIGHTS_FILTERS, window: '7d' },
      NOW,
    );
    expect(data.variations.totalEvents).toBeGreaterThan(0);
  });

  it('variation absente quand période précédente est vide', async () => {
    injectEvent({ eventName: 'page_view' });
    await runInsightsRefresh({ trigger: 'manual', actorId: null });
    const data = await getOverview(DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(data.variations.totalEvents).toBeUndefined();
  });
});

describe('services — top events stable + isConversion', () => {
  it('topEvents trié par count desc, conversion flag', async () => {
    for (let i = 0; i < 5; i++) injectEvent({ eventName: 'page_view', sessionId: `s${i}` });
    for (let i = 0; i < 3; i++) injectEvent({ eventName: 'add_to_cart', sessionId: `s${i}` });
    await runInsightsRefresh({ trigger: 'manual', actorId: null });
    const data = await getOverview(DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(data.topEvents[0]!.eventName).toBe('page_view');
    const atc = data.topEvents.find((e) => e.eventName === 'add_to_cart');
    expect(atc?.isConversion).toBe(true);
  });

  it('shares somment à environ 1', async () => {
    for (let i = 0; i < 10; i++) injectEvent({ sessionId: `s${i}` });
    await runInsightsRefresh({ trigger: 'manual', actorId: null });
    const data = await getOverview(DEFAULT_INSIGHTS_FILTERS, NOW);
    const totalShare = data.topEvents.reduce((s, e) => s + e.share, 0);
    expect(totalShare).toBeCloseTo(1, 5);
  });
});

describe('services — invariants', () => {
  it('bounceRate ∈ [0, 1]', async () => {
    for (let i = 0; i < 30; i++) {
      injectEvent({
        eventName: 'page_view',
        sessionId: `s${i % 5}`,
        pageRoute: i % 2 === 0 ? '/' : '/kit',
      });
    }
    await runInsightsRefresh({ trigger: 'manual', actorId: null });
    const data = await getOverview(DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(data.kpis.bounceRate).toBeGreaterThanOrEqual(0);
    expect(data.kpis.bounceRate).toBeLessThanOrEqual(1);
  });

  it('uniqueSessions <= totalEvents', async () => {
    for (let i = 0; i < 20; i++) injectEvent({ sessionId: `s${i % 4}` });
    await runInsightsRefresh({ trigger: 'manual', actorId: null });
    const data = await getOverview(DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(data.kpis.uniqueSessions).toBeLessThanOrEqual(data.kpis.totalEvents);
  });

  it('totalRows reflète le pool complet, pas le limit', async () => {
    for (let i = 0; i < 8; i++) {
      injectEvent({ pageRoute: `/p${i}`, sessionId: `s${i}` });
    }
    await runInsightsRefresh({ trigger: 'manual', actorId: null });
    const data = await getPagesTop(DEFAULT_INSIGHTS_FILTERS, 3, NOW);
    expect(data.pages.length).toBe(3);
    expect(data.totalRows).toBe(8);
  });
});
