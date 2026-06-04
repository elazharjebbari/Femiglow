/**
 * REPRODUCTION (vert AVANT-FIX) — onglet CTA.
 *
 * Audit : docs/analytics-audit-2026-06-04/ — finding AN-03. Les vrais clics sont
 * émis sous `pack_cta_click` / `video_cta_click` / `composition_post_cta_click`
 * (REJETÉS à l'ingestion, hors schéma) ; `cta_impression`/`cta_click` ne sont
 * jamais stockés (DB=0). Or `getCtaData` n'agrège QUE `cta_impression`/`cta_click`.
 *
 * Sur le dataset réaliste prod (sans aucun cta_*), on prouve que le dashboard CTA
 * est entièrement vide : totals.impressions=0, clicks=0, revenue=0, rows=[], même
 * en présence de purchases réels (aucun clic à matcher pour l'attribution).
 *
 * Garde-fous AN-08 (revenu MAD → cents, non régressé) conservés. `it.todo` =
 * spec cible après fix (cta_* stockés / pack_cta_click normalisé).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';

import { __clearAnalyticsCache } from '../cache';
import { getCtaData } from './cta';
import { AUDIT_NOW, pushEvent, seedRealisticEvents } from './__fixtures__/realistic-events';
import type { AnalyticsFilters } from '../filters';

const NOW = AUDIT_NOW;

const FILTERS: AnalyticsFilters = {
  period: 'custom',
  device: 'all',
  traffic: 'all',
  from: new Date('2026-06-04T00:00:00Z').toISOString(),
  to: new Date('2026-06-05T00:00:00Z').toISOString(),
};

beforeEach(() => {
  resetMemoryStore();
});

afterEach(() => {
  __clearAnalyticsCache();
});

describe('CTA audit — reproduction AN-03 (dashboard vide sans cta_*)', () => {
  it('A06-I001 [AN-03] onglet CTA vide sur dataset prod-like (aucun cta_click/cta_impression)', async () => {
    seedRealisticEvents();
    const data = await getCtaData(FILTERS, NOW);
    expect(data.totals.impressions).toBe(0);
    expect(data.totals.clicks).toBe(0);
    expect(data.totals.revenueAttributedCents).toBe(0);
    expect(data.rows.length).toBe(0);
  });

  it('A06-I002 [AN-03] purchases réels non attribués (aucun cta_click à matcher)', async () => {
    // La fixture contient 3 purchases (value 320) mais ZÉRO cta_click :
    // l'attribution last-click ne trouve rien → rows vides, revenue 0.
    seedRealisticEvents();
    const data = await getCtaData(FILTERS, NOW);
    expect(data.rows.length).toBe(0);
    expect(data.totals.revenueAttributedCents).toBe(0);
  });

  it('A06-I003 [AN-03] topMessages et topPages vides', async () => {
    seedRealisticEvents();
    const data = await getCtaData(FILTERS, NOW);
    expect(data.topMessages.length).toBe(0);
    expect(data.topPages.length).toBe(0);
  });

  it('A06-I004 [AN-03] conversionRate global null quand clicks=0', async () => {
    seedRealisticEvents();
    const data = await getCtaData(FILTERS, NOW);
    expect(data.totals.conversionRate).toBeNull();
  });
});

describe('CTA audit — garde-fou AN-08 (revenu MAD → cents non régressé)', () => {
  it('A06-I005 [AN-08] revenu 320 MAD = 32000 cents (value MAD ×100)', async () => {
    const store = (await import('@/lib/db/client')).memoryStore();
    store.trackingComponents.set('c1', {
      id: 'c1',
      name: 'c1',
      path: 'Comp/c1',
      category: 'cta_primary',
      description: null,
      enabled: true,
      defaultParams: { label: 'Composer' },
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });
    pushEvent({ id: '1', sessionId: 'S1', eventName: 'cta_click', componentId: 'c1', receivedAt: new Date('2026-06-04T10:00:00Z') });
    pushEvent({ id: '2', sessionId: 'S1', eventName: 'purchase', receivedAt: new Date('2026-06-04T10:10:00Z'), payload: { value: 320 } });
    const data = await getCtaData(FILTERS, NOW);
    expect(data.rows.find((r) => r.componentId === 'c1')?.revenueAttributedCents).toBe(32000);
  });

  it('A06-I006 [AN-08] amount_cents pris tel quel (déjà en cents)', async () => {
    const store = (await import('@/lib/db/client')).memoryStore();
    store.trackingComponents.set('c1', {
      id: 'c1',
      name: 'c1',
      path: 'Comp/c1',
      category: 'cta_primary',
      description: null,
      enabled: true,
      defaultParams: { label: 'Composer' },
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });
    pushEvent({ id: '1', sessionId: 'S1', eventName: 'cta_click', componentId: 'c1', receivedAt: new Date('2026-06-04T10:00:00Z') });
    pushEvent({ id: '2', sessionId: 'S1', eventName: 'purchase', receivedAt: new Date('2026-06-04T10:10:00Z'), payload: { amount_cents: 32000 } });
    const data = await getCtaData(FILTERS, NOW);
    expect(data.rows.find((r) => r.componentId === 'c1')?.revenueAttributedCents).toBe(32000);
  });
});

describe('CTA audit — spec cible APRÈS-FIX (documentée, non exécutée)', () => {
  it.todo('A06-I007 [SPEC après-fix AN-03] impressions/clicks comptés une fois cta_* stockés');
  it.todo('A06-I008 [SPEC après-fix AN-03] attribution last-click même session');
  it.todo('A06-I009 [SPEC après-fix AN-03] fallback 7j attribue clic 3 jours avant');
  it.todo('A06-I010 [SPEC après-fix AN-03] clic 8 jours avant non attribué (hors fenêtre)');
});
