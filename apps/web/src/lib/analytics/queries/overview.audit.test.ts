/**
 * SPEC APRÈS-FIX — onglet Vue d'ensemble (findings AN-01 + AN-07).
 *
 * Fix : `view_item` est désormais reconnu comme signal de « page-vue »
 * (PAGE_VIEW_EVENTS) pour le rebond, les top pages, la série et le KPI
 * pageViews — l'app FemiGlow n'émet pas de `page_view` générique. Et Overview
 * filtre maintenant `analytics_storage='granted'` comme les autres onglets.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';

import { getOverviewData } from './overview';
import { AUDIT_FROM, AUDIT_NOW, pushEvent, seedRealisticEvents } from './__fixtures__/realistic-events';
import type { AnalyticsFilters } from '../filters';

const NOW = AUDIT_NOW;
const CUSTOM_FILTERS: AnalyticsFilters = {
  period: 'custom',
  device: 'all',
  traffic: 'all',
  from: AUDIT_FROM.toISOString(),
  to: NOW.toISOString(),
};

beforeEach(() => {
  resetMemoryStore();
});

describe('Overview audit — AN-01 (view_item compté comme page-vue)', () => {
  it('A01-U004 [AN-01] bounceRate dérive de view_item-as-page (1 vue = rebond)', async () => {
    // s1 : 1 view_item (rebond) ; s2 : 2 view_item (non rebond) → 1/2 = 0.5.
    pushEvent({ id: '1', sessionId: 's1', eventName: 'view_item', pageRoute: '/kit' });
    pushEvent({ id: '2', sessionId: 's2', eventName: 'view_item', pageRoute: '/kit' });
    pushEvent({ id: '3', sessionId: 's2', eventName: 'view_item', pageRoute: '/journal' });
    const data = await getOverviewData(CUSTOM_FILTERS, NOW);
    expect(data.kpis.bounceRate.current).toBe(0.5);
  });

  it('A01-U005 [AN-01] pageViews reflète les vues réelles (>0)', async () => {
    seedRealisticEvents();
    const data = await getOverviewData(CUSTOM_FILTERS, NOW);
    expect(data.kpis.pageViews.current).toBeGreaterThan(0);
    expect(data.kpis.bounceRate.current).not.toBeNull();
  });

  it('A02-U004 [AN-01] topPages compte les view_item /kit', async () => {
    for (let i = 0; i < 5; i += 1) {
      pushEvent({ id: `v${i}`, sessionId: `s${i}`, eventName: 'view_item', pageRoute: '/kit', eventCategory: 'page' });
    }
    const data = await getOverviewData(CUSTOM_FILTERS, NOW);
    expect(data.topPages[0]?.pageRoute).toBe('/kit');
    expect(data.topPages[0]?.pageViews).toBe(5);
  });

  it('A02-U005 [AN-01] dataset mixte : /kit (view_item) ET /journal (page_view) listés', async () => {
    pushEvent({ id: 'pv', sessionId: 's1', eventName: 'page_view', pageRoute: '/journal', eventCategory: 'page' });
    for (let i = 0; i < 5; i += 1) {
      pushEvent({ id: `v${i}`, sessionId: `s_kit_${i}`, eventName: 'view_item', pageRoute: '/kit', eventCategory: 'page' });
    }
    const data = await getOverviewData(CUSTOM_FILTERS, NOW);
    // /kit (5) avant /journal (1), triés par pageViews desc.
    expect(data.topPages.map((p) => p.pageRoute)).toEqual(['/kit', '/journal']);
  });

  it('A01-U006 [AN-01] série temporelle : pageViews > 0', async () => {
    seedRealisticEvents();
    const data = await getOverviewData(CUSTOM_FILTERS, NOW);
    expect(data.series.some((p) => p.pageViews > 0)).toBe(true);
  });

  it('A01-U007 [AN-01] état vide réel : bounceRate=null, topPages=[]', async () => {
    const data = await getOverviewData(CUSTOM_FILTERS, NOW);
    expect(data.kpis.bounceRate.current).toBeNull();
    expect(data.topPages).toEqual([]);
  });
});

describe('Overview audit — AN-07 (filtre consentement aligné)', () => {
  it('A01-U008 [AN-07] overview exclut les sessions consentement refusé', async () => {
    pushEvent({ id: '1', sessionId: 's1', eventName: 'view_item' });
    pushEvent({ id: '2', sessionId: 's2', eventName: 'view_item' });
    pushEvent({ id: '3', sessionId: 's3', eventName: 'view_item', consentDenied: true });
    const data = await getOverviewData(CUSTOM_FILTERS, NOW);
    // granted uniquement → 2 sessions (cohérent avec funnel/cta/checkout).
    expect(data.kpis.sessions.current).toBe(2);
  });
});
