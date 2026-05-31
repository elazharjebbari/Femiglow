import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { TrackingEventLogEntry } from '@/lib/db/types';
import { runInsightsRefresh, getInsightsRefreshStatus } from './refresh';
import { setInsightsRefreshEnabled } from './settings';

function injectEvents(events: Partial<TrackingEventLogEntry>[]): void {
  const store = memoryStore();
  for (const e of events) {
    const id = e.id ?? createId('evt');
    store.trackingEventsLog.set(id, {
      id,
      eventId: e.eventId ?? id,
      eventName: e.eventName ?? 'page_view',
      eventCategory: e.eventCategory ?? 'page',
      pageId: null,
      componentId: e.componentId ?? null,
      pageRoute: e.pageRoute ?? '/',
      anonymousId: e.anonymousId ?? 'anon_1',
      sessionId: e.sessionId ?? 'sess_1',
      userId: null,
      consentSnapshot: { analytics: true } as never,
      payload: e.payload ?? {},
      uaHash: 'h',
      ipAnonymized: '0.0.0.0',
      device: e.device ?? 'mobile',
      locale: e.locale ?? 'fr-MA',
      isConversion: e.isConversion ?? false,
      providersDispatched: [],
      providersResults: {},
      receivedAt: e.receivedAt ?? new Date(),
      schemaVersion: 1,
      trafficSource: null,
      trafficMedium: null,
      experimentId: null,
      experimentVariant: null,
    });
  }
}

beforeEach(() => {
  resetMemoryStore();
});

describe('runInsightsRefresh — happy path', () => {
  it('agrège des events vers les tables insights_*', async () => {
    injectEvents([
      { eventName: 'page_view', pageRoute: '/', sessionId: 'A' },
      { eventName: 'page_view', pageRoute: '/', sessionId: 'B' },
      { eventName: 'add_to_cart', componentId: 'cta-1', sessionId: 'A' },
    ]);

    const result = await runInsightsRefresh({ trigger: 'manual', actorId: 'adm_1' });

    expect(result.ok).toBe(true);
    expect(result.runId).toBeTruthy();
    expect(result.counts.event).toBeGreaterThan(0);

    const store = memoryStore();
    expect(store.insightsEventDaily.size).toBeGreaterThan(0);
    expect(store.insightsPageDaily.size).toBe(1);
    expect(store.insightsComponentDaily.size).toBe(1);
  });

  it('persiste un run en status success', async () => {
    injectEvents([{ eventName: 'page_view' }]);
    const result = await runInsightsRefresh({ trigger: 'cron', actorId: null });
    const store = memoryStore();
    const run = store.insightsRefreshRun.get(result.runId!);
    expect(run?.status).toBe('success');
    expect(run?.finishedAt).toBeInstanceOf(Date);
  });

  it('idempotent : 2 runs successifs ne dupliquent pas', async () => {
    injectEvents([{ eventName: 'page_view' }]);
    await runInsightsRefresh({ trigger: 'manual', actorId: null });
    const sizeAfterFirst = memoryStore().insightsEventDaily.size;
    await runInsightsRefresh({ trigger: 'manual', actorId: null });
    expect(memoryStore().insightsEventDaily.size).toBe(sizeAfterFirst);
  });

  it('liste vide produit un run vide success', async () => {
    const result = await runInsightsRefresh({ trigger: 'manual', actorId: null });
    expect(result.ok).toBe(true);
    expect(result.counts.event).toBe(0);
  });
});

describe('runInsightsRefresh — toggle OFF', () => {
  it('cron + toggle OFF = skipped', async () => {
    await setInsightsRefreshEnabled(false);
    const result = await runInsightsRefresh({ trigger: 'cron', actorId: null });
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('disabled');
  });

  it('manuel + toggle OFF = run quand même', async () => {
    await setInsightsRefreshEnabled(false);
    injectEvents([{ eventName: 'page_view' }]);
    const result = await runInsightsRefresh({ trigger: 'manual', actorId: 'adm_1' });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBeUndefined();
  });
});

describe('runInsightsRefresh — lock pessimiste', () => {
  it('refuse si un run actif existe < 5 min', async () => {
    const store = memoryStore();
    store.insightsRefreshRun.set('irf_active', {
      id: 'irf_active',
      trigger: 'cron',
      status: 'running',
      startedAt: new Date(Date.now() - 60_000),
      finishedAt: null,
      durationsMs: {},
      counts: {},
      errorCode: null,
      errorMessage: null,
      triggeredBy: null,
    });
    await expect(
      runInsightsRefresh({ trigger: 'manual', actorId: null }),
    ).rejects.toThrow(/refresh_in_progress/);
  });

  it('autorise si lock orphelin > 5 min', async () => {
    const store = memoryStore();
    store.insightsRefreshRun.set('irf_orphan', {
      id: 'irf_orphan',
      trigger: 'cron',
      status: 'running',
      startedAt: new Date(Date.now() - 10 * 60_000),
      finishedAt: null,
      durationsMs: {},
      counts: {},
      errorCode: null,
      errorMessage: null,
      triggeredBy: null,
    });
    const result = await runInsightsRefresh({ trigger: 'manual', actorId: null });
    expect(result.ok).toBe(true);
  });
});

describe('getInsightsRefreshStatus', () => {
  it('renvoie lastRun null si jamais exécuté', async () => {
    const status = await getInsightsRefreshStatus();
    expect(status.lastRun).toBeNull();
    expect(status.lockHeld).toBe(false);
    expect(status.enabled).toBe(true);
    expect(status.intervalMinutes).toBe(15);
  });

  it('renvoie lastRun success après refresh', async () => {
    injectEvents([{ eventName: 'page_view' }]);
    await runInsightsRefresh({ trigger: 'manual', actorId: 'adm_1' });
    const status = await getInsightsRefreshStatus();
    expect(status.lastRun?.status).toBe('success');
    expect(status.lockHeld).toBe(false);
  });

  it('reflète toggle OFF', async () => {
    await setInsightsRefreshEnabled(false);
    const status = await getInsightsRefreshStatus();
    expect(status.enabled).toBe(false);
  });
});
