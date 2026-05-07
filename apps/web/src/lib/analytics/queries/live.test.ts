/**
 * Tests des queries Live.
 * cf. docs/analytics/06-tests-strategy.md §3 et 05-onglets-specs.md §2
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import type { TrackingEventLogEntry } from '@/lib/db/types';

import { clearLiveSnapshotCache, readLiveSnapshot } from './live';

const NOW = new Date('2026-05-06T12:00:00Z');

function pushEvent(entry: Partial<TrackingEventLogEntry> & {
  id: string;
  receivedAt: Date;
  sessionId: string;
  anonymousId: string;
}): void {
  const store = memoryStore();
  const full: TrackingEventLogEntry = {
    id: entry.id,
    eventId: entry.eventId ?? `evt_${entry.id}`,
    eventName: entry.eventName ?? 'page_view',
    eventCategory: entry.eventCategory ?? 'page',
    pageId: entry.pageId ?? null,
    componentId: entry.componentId ?? null,
    pageRoute: entry.pageRoute ?? '/home',
    anonymousId: entry.anonymousId,
    sessionId: entry.sessionId,
    userId: entry.userId ?? null,
    consentSnapshot: entry.consentSnapshot ?? {
      ad_storage: 'denied',
      analytics_storage: 'granted',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functional_storage: 'granted',
    },
    payload: entry.payload ?? {},
    uaHash: entry.uaHash ?? 'ua_hash',
    ipAnonymized: entry.ipAnonymized ?? '0.0.0.0',
    device: entry.device ?? 'mobile',
    locale: entry.locale ?? 'fr-FR',
    isConversion: entry.isConversion ?? false,
    providersDispatched: entry.providersDispatched ?? [],
    providersResults: entry.providersResults ?? {},
    receivedAt: entry.receivedAt,
    schemaVersion: entry.schemaVersion ?? 1,
    trafficSource: entry.trafficSource ?? null,
    trafficMedium: entry.trafficMedium ?? null,
    experimentId: entry.experimentId ?? null,
    experimentVariant: entry.experimentVariant ?? null,
  };
  store.trackingEventsLog.set(full.id, full);
  store.trackingEventsLogOrder.push(full.id);
}

beforeEach(() => {
  resetMemoryStore();
  clearLiveSnapshotCache();
});

describe('readLiveSnapshot', () => {
  it('returns empty snapshot when there are no events', async () => {
    const snap = await readLiveSnapshot({ now: NOW });
    expect(snap.kpiBig.online).toBe(0);
    expect(snap.kpiBig.conversions).toBe(0);
    expect(snap.kpiBig.ctaPurchase).toBe(0);
    expect(snap.byPage).toEqual([]);
    expect(snap.bySource).toEqual([]);
    expect(snap.byDevice).toEqual([]);
    expect(snap.recentEvents).toEqual([]);
    expect(snap.funnel).toEqual([
      { stage: 'tof', sessions: 0 },
      { stage: 'mof', sessions: 0 },
      { stage: 'bof', sessions: 0 },
      { stage: 'conversion', sessions: 0 },
    ]);
  });

  it('counts online sessions strictly within the 5-minute window', async () => {
    pushEvent({
      id: '1',
      sessionId: 's_recent',
      anonymousId: 'a1',
      receivedAt: new Date('2026-05-06T11:58:00Z'),
    });
    pushEvent({
      id: '2',
      sessionId: 's_old',
      anonymousId: 'a2',
      receivedAt: new Date('2026-05-06T11:40:00Z'),
    });
    const snap = await readLiveSnapshot({ now: NOW });
    expect(snap.kpiBig.online).toBe(1);
  });

  it('counts purchases and CTA clicks within the selected window', async () => {
    pushEvent({
      id: 'p1',
      sessionId: 's1',
      anonymousId: 'a1',
      eventName: 'purchase',
      isConversion: true,
      receivedAt: new Date('2026-05-06T11:30:00Z'),
    });
    pushEvent({
      id: 'p2',
      sessionId: 's2',
      anonymousId: 'a2',
      eventName: 'cta_click',
      payload: { cta_intent: 'purchase' },
      receivedAt: new Date('2026-05-06T11:45:00Z'),
    });
    pushEvent({
      id: 'p3',
      sessionId: 's3',
      anonymousId: 'a3',
      eventName: 'cta_click',
      payload: { cta_intent: 'newsletter' },
      receivedAt: new Date('2026-05-06T11:55:00Z'),
    });
    const snap = await readLiveSnapshot({ now: NOW, window: '1h' });
    expect(snap.kpiBig.conversions).toBe(1);
    expect(snap.kpiBig.ctaPurchase).toBe(1); // newsletter exclu
  });

  it('groups online users by page (top 10)', async () => {
    for (let i = 0; i < 3; i++) {
      pushEvent({
        id: `kit_${i}`,
        sessionId: `kit_${i}`,
        anonymousId: `a_kit_${i}`,
        eventName: 'page_view',
        pageRoute: '/kit',
        receivedAt: new Date('2026-05-06T11:58:00Z'),
      });
    }
    pushEvent({
      id: 'home',
      sessionId: 'home',
      anonymousId: 'a_home',
      eventName: 'page_view',
      pageRoute: '/',
      receivedAt: new Date('2026-05-06T11:59:00Z'),
    });
    const snap = await readLiveSnapshot({ now: NOW });
    expect(snap.byPage).toEqual([
      { pageRoute: '/kit', users: 3 },
      { pageRoute: '/', users: 1 },
    ]);
  });

  it('groups by source, prioritizing trafficSource over payload', async () => {
    pushEvent({
      id: 's1',
      sessionId: 's1',
      anonymousId: 'a1',
      trafficSource: 'google',
      receivedAt: new Date('2026-05-06T11:30:00Z'),
    });
    pushEvent({
      id: 's2',
      sessionId: 's2',
      anonymousId: 'a2',
      payload: { utm_source: 'meta', utm_medium: 'paid_social' },
      receivedAt: new Date('2026-05-06T11:30:00Z'),
    });
    const snap = await readLiveSnapshot({ now: NOW, window: '1h' });
    const sources = snap.bySource.map((r) => r.source).sort();
    expect(sources).toEqual(['google', 'meta']);
  });

  it('groups by device with unknown fallback', async () => {
    pushEvent({
      id: 'd1',
      sessionId: 's1',
      anonymousId: 'a1',
      device: 'mobile',
      receivedAt: new Date('2026-05-06T11:30:00Z'),
    });
    pushEvent({
      id: 'd2',
      sessionId: 's2',
      anonymousId: 'a2',
      device: 'desktop',
      receivedAt: new Date('2026-05-06T11:30:00Z'),
    });
    const snap = await readLiveSnapshot({ now: NOW });
    const devices = snap.byDevice.map((r) => r.device).sort();
    expect(devices).toEqual(['desktop', 'mobile']);
  });

  it('returns recent events newest first, capped at 100', async () => {
    for (let i = 0; i < 120; i++) {
      pushEvent({
        id: `e_${i}`,
        sessionId: `s_${i}`,
        anonymousId: `a_${i}`,
        eventName: 'page_view',
        receivedAt: new Date(NOW.getTime() - i * 1000),
      });
    }
    const snap = await readLiveSnapshot({ now: NOW });
    expect(snap.recentEvents).toHaveLength(100);
    // Premier élément = le plus récent (i=0)
    expect(snap.recentEvents[0]?.eventId).toBe('evt_e_0');
  });

  it('classes events into TOF/MOF/BOF/conversion stages', async () => {
    pushEvent({
      id: 'pv',
      sessionId: 's1',
      anonymousId: 'a1',
      eventName: 'page_view',
      receivedAt: new Date('2026-05-06T11:30:00Z'),
    });
    pushEvent({
      id: 'sd',
      sessionId: 's2',
      anonymousId: 'a2',
      eventName: 'scroll_depth_50',
      receivedAt: new Date('2026-05-06T11:30:00Z'),
    });
    pushEvent({
      id: 'cart',
      sessionId: 's3',
      anonymousId: 'a3',
      eventName: 'add_to_cart',
      receivedAt: new Date('2026-05-06T11:30:00Z'),
    });
    pushEvent({
      id: 'buy',
      sessionId: 's4',
      anonymousId: 'a4',
      eventName: 'purchase',
      isConversion: true,
      receivedAt: new Date('2026-05-06T11:30:00Z'),
    });
    const snap = await readLiveSnapshot({ now: NOW, window: '1h' });
    const counts = Object.fromEntries(snap.funnel.map((s) => [s.stage, s.sessions]));
    expect(counts.tof).toBe(1);
    expect(counts.mof).toBe(1);
    expect(counts.bof).toBe(1);
    expect(counts.conversion).toBe(1);
  });

  it('filters out events with denied analytics consent', async () => {
    pushEvent({
      id: 'allowed',
      sessionId: 's1',
      anonymousId: 'a1',
      receivedAt: new Date('2026-05-06T11:58:00Z'),
    });
    pushEvent({
      id: 'denied',
      sessionId: 's2',
      anonymousId: 'a2',
      receivedAt: new Date('2026-05-06T11:58:00Z'),
      consentSnapshot: {
        ad_storage: 'denied',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        functional_storage: 'denied',
      },
    });
    const snap = await readLiveSnapshot({ now: NOW });
    expect(snap.kpiBig.online).toBe(1);
  });

  it('reuses cached snapshots within 1 second', async () => {
    pushEvent({
      id: 'pv',
      sessionId: 's1',
      anonymousId: 'a1',
      receivedAt: new Date('2026-05-06T11:58:00Z'),
    });
    const a = await readLiveSnapshot({ now: NOW });
    // Mutation de la base APRÈS le snapshot cache
    pushEvent({
      id: 'pv2',
      sessionId: 's2',
      anonymousId: 'a2',
      receivedAt: new Date('2026-05-06T11:59:00Z'),
    });
    const b = await readLiveSnapshot({ now: NOW });
    // Cache hit → snap inchangé
    expect(b.kpiBig.online).toBe(a.kpiBig.online);
    // Bypass cache → nouvelle valeur
    const c = await readLiveSnapshot({ now: NOW, bypassCache: true });
    expect(c.kpiBig.online).toBe(2);
  });
});
