/**
 * Tests des queries Vue d'ensemble.
 * cf. docs/analytics/06-tests-strategy.md §2.2
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { memoryStore, resetMemoryStore } from '@/lib/db/client';
import type { TrackingEventLogEntry } from '@/lib/db/types';

import { getOverviewData } from './overview';
import type { AnalyticsFilters } from '../filters';

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

const TODAY_FILTER: AnalyticsFilters = {
  period: 'today',
  device: 'all',
  traffic: 'all',
};

beforeEach(() => {
  resetMemoryStore();
});

describe('getOverviewData', () => {
  it('returns zero KPIs when no events', async () => {
    const data = await getOverviewData(TODAY_FILTER, NOW);
    expect(data.kpis.sessions.current).toBe(0);
    expect(data.kpis.uniqueVisitors.current).toBe(0);
    expect(data.kpis.pageViews.current).toBe(0);
    expect(data.kpis.avgSessionDuration.current).toBeNull();
    expect(data.kpis.bounceRate.current).toBeNull();
    expect(data.kpis.conversionRate.current).toBeNull();
    expect(data.series).toEqual([]);
    expect(data.topSources).toEqual([]);
    expect(data.topPages).toEqual([]);
  });

  it('counts unique sessions and visitors', async () => {
    pushEvent({ id: '1', sessionId: 's1', anonymousId: 'a1', receivedAt: new Date('2026-05-06T10:00:00Z') });
    pushEvent({ id: '2', sessionId: 's1', anonymousId: 'a1', receivedAt: new Date('2026-05-06T10:05:00Z') });
    pushEvent({ id: '3', sessionId: 's2', anonymousId: 'a2', receivedAt: new Date('2026-05-06T11:00:00Z') });
    const data = await getOverviewData(TODAY_FILTER, NOW);
    expect(data.kpis.sessions.current).toBe(2);
    expect(data.kpis.uniqueVisitors.current).toBe(2);
    expect(data.kpis.pageViews.current).toBe(3);
  });

  it('computes bounce rate (sessions with ≤1 page_view)', async () => {
    pushEvent({ id: '1', sessionId: 's1', anonymousId: 'a1', receivedAt: new Date('2026-05-06T10:00:00Z') });
    pushEvent({ id: '2', sessionId: 's2', anonymousId: 'a2', receivedAt: new Date('2026-05-06T10:00:00Z') });
    pushEvent({ id: '3', sessionId: 's2', anonymousId: 'a2', receivedAt: new Date('2026-05-06T10:02:00Z'), pageRoute: '/about' });
    const data = await getOverviewData(TODAY_FILTER, NOW);
    // s1 a 1 page_view (bounced), s2 a 2 page_views (non bounced) → 1/2 = 0.5
    expect(data.kpis.bounceRate.current).toBe(0.5);
  });

  it('computes conversion rate (sessions with isConversion=true)', async () => {
    pushEvent({ id: '1', sessionId: 's1', anonymousId: 'a1', receivedAt: new Date('2026-05-06T10:00:00Z') });
    pushEvent({ id: '2', sessionId: 's1', anonymousId: 'a1', receivedAt: new Date('2026-05-06T10:05:00Z'), isConversion: true });
    pushEvent({ id: '3', sessionId: 's2', anonymousId: 'a2', receivedAt: new Date('2026-05-06T11:00:00Z') });
    const data = await getOverviewData(TODAY_FILTER, NOW);
    expect(data.kpis.conversionRate.current).toBe(0.5);
  });

  it('computes avg session duration in seconds', async () => {
    pushEvent({ id: '1', sessionId: 's1', anonymousId: 'a1', receivedAt: new Date('2026-05-06T10:00:00Z') });
    pushEvent({ id: '2', sessionId: 's1', anonymousId: 'a1', receivedAt: new Date('2026-05-06T10:01:00Z') });
    pushEvent({ id: '3', sessionId: 's2', anonymousId: 'a2', receivedAt: new Date('2026-05-06T11:00:00Z') });
    pushEvent({ id: '4', sessionId: 's2', anonymousId: 'a2', receivedAt: new Date('2026-05-06T11:03:00Z') });
    const data = await getOverviewData(TODAY_FILTER, NOW);
    // s1 dure 60s, s2 dure 180s → moyenne 120s
    expect(data.kpis.avgSessionDuration.current).toBe(120);
  });

  it('builds time series bucketed by hour', async () => {
    pushEvent({ id: '1', sessionId: 's1', anonymousId: 'a1', receivedAt: new Date('2026-05-06T10:15:00Z') });
    pushEvent({ id: '2', sessionId: 's2', anonymousId: 'a2', receivedAt: new Date('2026-05-06T10:45:00Z') });
    pushEvent({ id: '3', sessionId: 's3', anonymousId: 'a3', receivedAt: new Date('2026-05-06T11:00:00Z') });
    const data = await getOverviewData(TODAY_FILTER, NOW);
    expect(data.range.granularity).toBe('hour');
    expect(data.series.length).toBe(2); // 10h et 11h buckets
  });

  it('aggregates top sources from utm_source', async () => {
    pushEvent({
      id: '1',
      sessionId: 's1',
      anonymousId: 'a1',
      receivedAt: new Date('2026-05-06T10:00:00Z'),
      payload: { utm_source: 'google' },
    });
    pushEvent({
      id: '2',
      sessionId: 's2',
      anonymousId: 'a2',
      receivedAt: new Date('2026-05-06T10:05:00Z'),
      payload: { utm_source: 'google' },
    });
    pushEvent({
      id: '3',
      sessionId: 's3',
      anonymousId: 'a3',
      receivedAt: new Date('2026-05-06T11:00:00Z'),
      payload: { utm_source: 'meta' },
    });
    const data = await getOverviewData(TODAY_FILTER, NOW);
    const google = data.topSources.find((r) => r.source === 'google');
    const meta = data.topSources.find((r) => r.source === 'meta');
    expect(google?.sessions).toBe(2);
    expect(meta?.sessions).toBe(1);
    expect(data.topSources[0]?.source).toBe('google'); // sorted desc
  });

  it('aggregates top pages by page_views', async () => {
    pushEvent({ id: '1', sessionId: 's1', anonymousId: 'a1', receivedAt: new Date('2026-05-06T10:00:00Z'), pageRoute: '/home' });
    pushEvent({ id: '2', sessionId: 's2', anonymousId: 'a2', receivedAt: new Date('2026-05-06T10:05:00Z'), pageRoute: '/home' });
    pushEvent({ id: '3', sessionId: 's3', anonymousId: 'a3', receivedAt: new Date('2026-05-06T11:00:00Z'), pageRoute: '/about' });
    const data = await getOverviewData(TODAY_FILTER, NOW);
    expect(data.topPages[0]?.pageRoute).toBe('/home');
    expect(data.topPages[0]?.pageViews).toBe(2);
    expect(data.topPages[1]?.pageRoute).toBe('/about');
  });

  it('filters by device', async () => {
    pushEvent({ id: '1', sessionId: 's1', anonymousId: 'a1', receivedAt: new Date('2026-05-06T10:00:00Z'), device: 'mobile' });
    pushEvent({ id: '2', sessionId: 's2', anonymousId: 'a2', receivedAt: new Date('2026-05-06T10:05:00Z'), device: 'desktop' });
    const data = await getOverviewData({ ...TODAY_FILTER, device: 'mobile' }, NOW);
    expect(data.kpis.sessions.current).toBe(1);
  });

  it('filters by traffic source bucket', async () => {
    pushEvent({
      id: '1',
      sessionId: 's1',
      anonymousId: 'a1',
      receivedAt: new Date('2026-05-06T10:00:00Z'),
      trafficSource: 'google',
    });
    pushEvent({
      id: '2',
      sessionId: 's2',
      anonymousId: 'a2',
      receivedAt: new Date('2026-05-06T10:05:00Z'),
      trafficSource: 'meta',
    });
    const data = await getOverviewData({ ...TODAY_FILTER, traffic: 'google' }, NOW);
    expect(data.kpis.sessions.current).toBe(1);
  });

  it('computes delta vs previous period', async () => {
    // 2 sessions today
    pushEvent({ id: '1', sessionId: 's1', anonymousId: 'a1', receivedAt: new Date('2026-05-06T10:00:00Z') });
    pushEvent({ id: '2', sessionId: 's2', anonymousId: 'a2', receivedAt: new Date('2026-05-06T11:00:00Z') });
    // 1 session yesterday (comparison window for "today")
    pushEvent({ id: '3', sessionId: 's3', anonymousId: 'a3', receivedAt: new Date('2026-05-05T10:00:00Z') });
    const data = await getOverviewData(TODAY_FILTER, NOW);
    expect(data.kpis.sessions.current).toBe(2);
    expect(data.kpis.sessions.previous).toBe(1);
    expect(data.kpis.sessions.delta).toBe(1); // (2-1)/1 = 100 %
  });
});
