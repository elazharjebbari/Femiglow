/**
 * Tests d'intégration end-to-end : inject events → refresh → query → export.
 *
 * Vérifie qu'un scénario réaliste (visiteur navigue + convertit) produit
 * les bons chiffres dans tous les services et exports.
 */
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
import { exportCsv } from './exports';
import { DEFAULT_INSIGHTS_FILTERS } from './contracts';

const NOW = new Date('2026-05-08T15:00:00Z');

beforeEach(() => {
  resetMemoryStore();
});

function inject(overrides: Partial<TrackingEventLogEntry> = {}): void {
  const id = overrides.id ?? createId('evt');
  memoryStore().trackingEventsLog.set(id, {
    id,
    eventId: id,
    eventName: 'page_view',
    eventCategory: 'page',
    pageId: null,
    componentId: null,
    pageRoute: '/',
    anonymousId: 'anon_1',
    sessionId: 'sess_1',
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

/**
 * Scénario "boutique" : 100 visiteurs, 30 ajoutent au panier, 10 achètent.
 * Distribué sur 7 jours, 3 pages, 2 composants CTA.
 */
async function seedShopScenario(): Promise<void> {
  const baseDate = new Date('2026-05-02T10:00:00Z');
  for (let visitor = 0; visitor < 100; visitor++) {
    const day = visitor % 7;
    const at = new Date(baseDate.getTime() + day * 86_400_000 + visitor * 60_000);
    const sess = `sess_${visitor}`;
    const anon = `anon_${visitor % 80}`; // ~80 visiteurs uniques
    inject({ eventName: 'page_view', pageRoute: '/', sessionId: sess, anonymousId: anon, receivedAt: at });
    inject({ eventName: 'page_view', pageRoute: '/kit', sessionId: sess, anonymousId: anon, receivedAt: new Date(at.getTime() + 30_000) });
    inject({
      eventName: 'fg_section_view',
      pageRoute: '/kit',
      sessionId: sess,
      anonymousId: anon,
      payload: { section_id: 'rituel' },
      receivedAt: new Date(at.getTime() + 45_000),
    });
    inject({
      eventName: 'view_item',
      sessionId: sess,
      anonymousId: anon,
      receivedAt: new Date(at.getTime() + 60_000),
    });
    if (visitor < 30) {
      inject({
        eventName: 'add_to_cart',
        componentId: 'cta-recevoir',
        pageRoute: '/kit',
        sessionId: sess,
        anonymousId: anon,
        receivedAt: new Date(at.getTime() + 120_000),
      });
    }
    if (visitor < 10) {
      inject({
        eventName: 'begin_checkout',
        sessionId: sess,
        anonymousId: anon,
        receivedAt: new Date(at.getTime() + 180_000),
      });
      inject({
        eventName: 'add_payment_info',
        sessionId: sess,
        anonymousId: anon,
        receivedAt: new Date(at.getTime() + 240_000),
      });
      inject({
        eventName: 'purchase',
        sessionId: sess,
        anonymousId: anon,
        isConversion: true,
        payload: { value: 199.99 },
        receivedAt: new Date(at.getTime() + 300_000),
      });
    }
  }
  await runInsightsRefresh({ trigger: 'manual', actorId: 'adm_e2e' });
}

describe('end-to-end : scenario boutique 100 visiteurs', () => {
  it("overview : KPIs cohérents avec l'injection", async () => {
    await seedShopScenario();
    const data = await getOverview(
      { ...DEFAULT_INSIGHTS_FILTERS, window: '30d' },
      NOW,
    );
    expect(data.firstRun).toBe(false);
    expect(data.kpis.pageViews).toBe(200); // 100 × 2 pages
    expect(data.kpis.conversions).toBe(10); // 10 purchase isConversion
    // 100 sessions distinctes
    expect(data.kpis.uniqueSessions).toBeGreaterThanOrEqual(100);
  });

  it('pages : / et /kit tous deux 100 visites', async () => {
    await seedShopScenario();
    const data = await getPagesTop(
      { ...DEFAULT_INSIGHTS_FILTERS, window: '30d' },
      30,
      NOW,
    );
    const home = data.pages.find((p) => p.pageRoute === '/');
    const kit = data.pages.find((p) => p.pageRoute === '/kit');
    expect(home?.pageViews).toBe(100);
    expect(kit?.pageViews).toBe(100);
  });

  it('components : cta-recevoir = 30 add_to_cart', async () => {
    await seedShopScenario();
    const data = await getComponentsTop(
      { ...DEFAULT_INSIGHTS_FILTERS, window: '30d' },
      50,
      NOW,
    );
    const cta = data.components.find((c) => c.componentId === 'cta-recevoir');
    expect(cta?.total).toBe(30);
    expect(cta?.topEvent).toBe('add_to_cart');
  });

  it('component drill : événements + pages cohérents', async () => {
    await seedShopScenario();
    const data = await getComponentDetail(
      'cta-recevoir',
      { ...DEFAULT_INSIGHTS_FILTERS, window: '30d' },
      NOW,
    );
    expect(data.total).toBe(30);
    expect(data.events.find((e) => e.eventName === 'add_to_cart')?.count).toBe(30);
    expect(data.pages.find((p) => p.pageRoute === '/kit')?.count).toBe(30);
  });

  it('sections : section-rituel a 100 vues', async () => {
    await seedShopScenario();
    const data = await getSectionsTop(
      { ...DEFAULT_INSIGHTS_FILTERS, window: '30d' },
      30,
      NOW,
    );
    const sec = data.sections.find((s) => s.sectionId === 'rituel');
    expect(sec?.views).toBe(100);
  });

  it('funnel : drops cohérents 100 → 30 → 10 → 10 → 10', async () => {
    await seedShopScenario();
    const data = await getFunnel(
      { ...DEFAULT_INSIGHTS_FILTERS, window: '30d' },
      NOW,
    );
    expect(data.stages.find((s) => s.name === 'view_item')?.count).toBe(100);
    expect(data.stages.find((s) => s.name === 'add_to_cart')?.count).toBe(30);
    expect(data.stages.find((s) => s.name === 'begin_checkout')?.count).toBe(10);
    expect(data.stages.find((s) => s.name === 'add_payment_info')?.count).toBe(10);
    expect(data.stages.find((s) => s.name === 'purchase')?.count).toBe(10);
    // 10 × 199.99 € → 1999.90 € → 199_990 cents
    expect(data.totalRevenueCents).toBe(199_990);
  });

  it('export CSV pages : contient les routes et compte de lignes correct', async () => {
    await seedShopScenario();
    const csv = await exportCsv('pages', { ...DEFAULT_INSIGHTS_FILTERS, window: '30d' }, NOW);
    expect(csv.rowCount).toBeGreaterThanOrEqual(2);
    expect(csv.content).toContain('/kit');
    expect(csv.content).toContain('100'); // page_views
  });

  it('export CSV funnel : 5 lignes', async () => {
    await seedShopScenario();
    const csv = await exportCsv('funnel', { ...DEFAULT_INSIGHTS_FILTERS, window: '30d' }, NOW);
    expect(csv.rowCount).toBe(5);
    expect(csv.content).toContain('purchase');
  });

  it('drill page /kit : events + composants visibles', async () => {
    await seedShopScenario();
    const data = await getPageDetail(
      '/kit',
      { ...DEFAULT_INSIGHTS_FILTERS, window: '30d' },
      NOW,
    );
    expect(data.pageViews).toBe(100);
    expect(data.components.length).toBeGreaterThan(0);
  });

  it('dead components : ajout d\'un composant non-trigger → liste', async () => {
    memoryStore().trackingComponents.set('cmp_dormant', {
      id: 'cmp_dormant',
      key: 'cmp_dormant',
      name: 'Composant endormi',
      pageGroup: 'home',
    } as never);
    await seedShopScenario();
    const data = await getDeadComponents(
      { ...DEFAULT_INSIGHTS_FILTERS, window: '30d' },
      NOW,
    );
    const dead = data.components.find((c) => c.componentId === 'cmp_dormant');
    expect(dead).toBeTruthy();
  });
});

describe('end-to-end : isolation par fenêtre', () => {
  it('event hier vs today : seul today visible avec window=today', async () => {
    inject({
      receivedAt: new Date('2026-05-08T10:00:00Z'),
      eventName: 'page_view',
      pageRoute: '/today',
    });
    inject({
      receivedAt: new Date('2026-05-07T10:00:00Z'),
      eventName: 'page_view',
      pageRoute: '/yesterday',
    });
    await runInsightsRefresh({ trigger: 'manual', actorId: null });
    const today = await getPagesTop(
      { ...DEFAULT_INSIGHTS_FILTERS, window: 'today' },
      30,
      NOW,
    );
    expect(today.pages.find((p) => p.pageRoute === '/today')).toBeTruthy();
    expect(today.pages.find((p) => p.pageRoute === '/yesterday')).toBeFalsy();
    const yesterday = await getPagesTop(
      { ...DEFAULT_INSIGHTS_FILTERS, window: 'yesterday' },
      30,
      NOW,
    );
    expect(yesterday.pages.find((p) => p.pageRoute === '/yesterday')).toBeTruthy();
    expect(yesterday.pages.find((p) => p.pageRoute === '/today')).toBeFalsy();
  });

  it('filtre device=mobile exclut desktop', async () => {
    inject({
      eventName: 'page_view',
      pageRoute: '/mobile',
      device: 'mobile',
      sessionId: 'sM',
    });
    inject({
      eventName: 'page_view',
      pageRoute: '/mobile',
      device: 'desktop',
      sessionId: 'sD',
    });
    await runInsightsRefresh({ trigger: 'manual', actorId: null });
    const mobile = await getOverview(
      { ...DEFAULT_INSIGHTS_FILTERS, window: 'today', device: 'mobile' },
      NOW,
    );
    expect(mobile.kpis.totalEvents).toBe(1);
  });
});

describe('end-to-end : refresh idempotent + incremental', () => {
  it('3 runs successifs même events → mêmes totaux', async () => {
    inject({ eventName: 'page_view', sessionId: 'A' });
    inject({ eventName: 'page_view', sessionId: 'B' });
    await runInsightsRefresh({ trigger: 'manual', actorId: null });
    const before = memoryStore().insightsEventDaily.size;
    const before1 = Array.from(memoryStore().insightsEventDaily.values())[0]!.count;
    await runInsightsRefresh({ trigger: 'manual', actorId: null });
    await runInsightsRefresh({ trigger: 'manual', actorId: null });
    expect(memoryStore().insightsEventDaily.size).toBe(before);
    expect(Array.from(memoryStore().insightsEventDaily.values())[0]!.count).toBe(before1);
  });

  it('event ajouté entre 2 runs → comptage à jour', async () => {
    inject({ eventName: 'page_view', sessionId: 'A' });
    await runInsightsRefresh({ trigger: 'manual', actorId: null });
    inject({ eventName: 'page_view', sessionId: 'B' });
    await runInsightsRefresh({ trigger: 'manual', actorId: null });
    const data = await getOverview({ ...DEFAULT_INSIGHTS_FILTERS, window: 'today' }, NOW);
    expect(data.kpis.totalEvents).toBe(2);
  });
});
