import { beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import { runInsightsRefresh } from './refresh';
import { exportCsv } from './exports';
import { DEFAULT_INSIGHTS_FILTERS } from './contracts';

const NOW = new Date('2026-05-08T12:00:00Z');
const BOM = '﻿';

beforeEach(() => {
  resetMemoryStore();
});

async function seed() {
  for (let i = 0; i < 3; i++) {
    const id = createId('evt');
    memoryStore().trackingEventsLog.set(id, {
      id,
      eventId: id,
      eventName: 'page_view',
      eventCategory: 'page',
      pageId: null,
      componentId: null,
      pageRoute: i === 0 ? '/' : '/kit',
      anonymousId: 'a',
      sessionId: `sess_${i}`,
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
    });
  }
  await runInsightsRefresh({ trigger: 'manual', actorId: null });
}

describe('exportCsv', () => {
  it('overview produit un CSV avec BOM UTF-8', async () => {
    await seed();
    const csv = await exportCsv('overview', DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(csv.content.startsWith(BOM)).toBe(true);
    expect(csv.filename).toMatch(/^insights-overview-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('pages produit les colonnes attendues', async () => {
    await seed();
    const csv = await exportCsv('pages', DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(csv.content).toContain('page_route,page_views,sessions');
    expect(csv.content).toContain('/kit');
  });

  it('events produit le top events', async () => {
    await seed();
    const csv = await exportCsv('events', DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(csv.content).toContain('event_name');
    expect(csv.content).toContain('page_view');
  });

  it('funnel produit 5 lignes (1 par étape)', async () => {
    await seed();
    const csv = await exportCsv('funnel', DEFAULT_INSIGHTS_FILTERS, NOW);
    const lines = csv.content.replace(BOM, '').split('\n');
    expect(lines.length).toBe(6); // header + 5 stages
  });

  it('table vide → BOM seul + 0 rows', async () => {
    const csv = await exportCsv('pages', DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(csv.content).toBe(BOM);
    expect(csv.rowCount).toBe(0);
  });

  it("escape les valeurs avec virgules / guillemets", async () => {
    memoryStore().trackingComponents.set('cmp_X', {
      id: 'cmp_X',
      key: 'cmp_X',
      name: 'Carte, "produit"',
      pageGroup: 'home',
    } as never);
    await seed();
    const csv = await exportCsv('dead_components', DEFAULT_INSIGHTS_FILTERS, NOW);
    expect(csv.content).toContain('"Carte, ""produit"""');
  });
});
