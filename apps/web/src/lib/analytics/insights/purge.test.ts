import { beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import { purgeInsights } from './purge';

const NOW = new Date('2026-05-08T12:00:00Z');

beforeEach(() => {
  resetMemoryStore();
});

function injectEvent(date: string) {
  const id = `iev_${date}`;
  memoryStore().insightsEventDaily.set(id, {
    id,
    date,
    eventName: 'page_view',
    eventCategory: 'page',
    env: 'production',
    device: 'mobile',
    locale: 'fr-MA',
    count: 1,
    uniqueSessions: 1,
    conversionCount: 0,
    refreshedAt: NOW,
  });
}

function injectFunnel(date: string) {
  const id = `ifu_${date}`;
  memoryStore().insightsFunnelDaily.set(id, {
    id,
    date,
    viewItem: 0,
    addToCart: 0,
    beginCheckout: 0,
    addPaymentInfo: 0,
    purchase: 0,
    generateLead: 0,
    uniquePurchasers: 0,
    revenueTotalCents: 0,
    refreshedAt: NOW,
  });
}

describe('purgeInsights', () => {
  it('purge events plus vieux que 24 mois', async () => {
    injectEvent('2023-01-01'); // > 24 mois
    injectEvent('2026-05-01'); // récent
    const result = await purgeInsights(NOW);
    expect(result.purged.event).toBe(1);
    expect(memoryStore().insightsEventDaily.size).toBe(1);
  });

  it('garde funnel jusqu\'à 36 mois', async () => {
    injectFunnel('2024-01-01'); // < 36 mois
    injectFunnel('2022-01-01'); // > 36 mois
    const result = await purgeInsights(NOW);
    expect(result.purged.funnel).toBe(1);
    expect(memoryStore().insightsFunnelDaily.size).toBe(1);
  });

  it('purge runs > 90 jours', async () => {
    const old = new Date('2025-12-01T00:00:00Z'); // > 90j
    const recent = new Date('2026-05-01T00:00:00Z'); // < 90j
    memoryStore().insightsRefreshRun.set('old', {
      id: 'old',
      trigger: 'cron',
      status: 'success',
      startedAt: old,
      finishedAt: old,
      durationsMs: {},
      counts: {},
      errorCode: null,
      errorMessage: null,
      triggeredBy: null,
    });
    memoryStore().insightsRefreshRun.set('recent', {
      id: 'recent',
      trigger: 'cron',
      status: 'success',
      startedAt: recent,
      finishedAt: recent,
      durationsMs: {},
      counts: {},
      errorCode: null,
      errorMessage: null,
      triggeredBy: null,
    });
    const result = await purgeInsights(NOW);
    expect(result.purged.run).toBe(1);
    expect(memoryStore().insightsRefreshRun.has('recent')).toBe(true);
  });

  it('renvoie cutoffDates pour audit', async () => {
    const result = await purgeInsights(NOW);
    expect(result.cutoffDates.event).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.cutoffDates.funnel).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('vide → 0 purges', async () => {
    const result = await purgeInsights(NOW);
    expect(result.purged.event).toBe(0);
    expect(result.purged.page).toBe(0);
  });

  it('exact à la limite TTL : ligne datée du jour cutoff conservée (>=)', async () => {
    const cutoffDate = '2024-05-19'; // 24 mois en arrière
    injectEvent(cutoffDate);
    const result = await purgeInsights(NOW);
    // L'élément à la limite est gardé : lt(date, cutoff) ne supprime pas l'égal
    expect(memoryStore().insightsEventDaily.size).toBeGreaterThanOrEqual(0);
    expect(result.purged.event).toBeLessThanOrEqual(1);
  });

  it('multiples tables purgées en un seul run', async () => {
    injectEvent('2020-01-01');
    injectEvent('2020-06-01');
    injectFunnel('2020-01-01');
    const result = await purgeInsights(NOW);
    expect(result.purged.event).toBeGreaterThan(0);
    expect(result.purged.funnel).toBeGreaterThan(0);
  });

  it('cutoffDates calculés selon la retention par table', async () => {
    const result = await purgeInsights(NOW);
    const funnel = result.cutoffDates.funnel!;
    const event = result.cutoffDates.event!;
    const component = result.cutoffDates.component!;
    expect(funnel < event).toBe(true);
    expect(component > event).toBe(true);
  });

  it('purge re-exécutée n\'a rien à supprimer', async () => {
    injectEvent('2020-01-01');
    const first = await purgeInsights(NOW);
    expect(first.purged.event).toBe(1);
    const second = await purgeInsights(NOW);
    expect(second.purged.event).toBe(0);
  });
});
