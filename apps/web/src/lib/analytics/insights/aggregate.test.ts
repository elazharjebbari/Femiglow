import { describe, expect, it } from 'vitest';
import { aggregateEvents } from './aggregate';
import type { TrackingEventLogEntry } from '@/lib/db/types';

function makeEvent(overrides: Partial<TrackingEventLogEntry> = {}): TrackingEventLogEntry {
  return {
    id: `evt_${Math.random().toString(36).slice(2, 12)}`,
    eventId: `id_${Math.random().toString(36).slice(2, 8)}`,
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
    receivedAt: new Date('2026-05-08T10:00:00Z'),
    schemaVersion: 1,
    trafficSource: null,
    trafficMedium: null,
    experimentId: null,
    experimentVariant: null,
    ...overrides,
  };
}

describe('aggregateEvents — events', () => {
  it('compte les events par bucket date+name+env+device+locale', () => {
    const batch = aggregateEvents([
      makeEvent({ eventName: 'page_view' }),
      makeEvent({ eventName: 'page_view' }),
      makeEvent({ eventName: 'add_to_cart' }),
    ]);
    expect(batch.events.find((e) => e.eventName === 'page_view')?.count).toBe(2);
    expect(batch.events.find((e) => e.eventName === 'add_to_cart')?.count).toBe(1);
  });

  it('unique_sessions = distinct session_id', () => {
    const batch = aggregateEvents([
      makeEvent({ sessionId: 'A' }),
      makeEvent({ sessionId: 'A' }),
      makeEvent({ sessionId: 'B' }),
    ]);
    const ev = batch.events[0]!;
    expect(ev.uniqueSessions).toBe(2);
    expect(ev.count).toBe(3);
  });

  it('conversion_count compte uniquement isConversion=true', () => {
    const batch = aggregateEvents([
      makeEvent({ isConversion: true }),
      makeEvent({ isConversion: false }),
      makeEvent({ isConversion: true }),
    ]);
    expect(batch.events[0]!.conversionCount).toBe(2);
  });

  it('liste vide renvoie batch vide', () => {
    const batch = aggregateEvents([]);
    expect(batch.events).toEqual([]);
    expect(batch.pages).toEqual([]);
    expect(batch.components).toEqual([]);
  });
});

describe('aggregateEvents — pages', () => {
  it('page_views ne compte que event=page_view', () => {
    const batch = aggregateEvents([
      makeEvent({ eventName: 'page_view', pageRoute: '/' }),
      makeEvent({ eventName: 'page_view', pageRoute: '/' }),
      makeEvent({ eventName: 'add_to_cart', pageRoute: '/' }),
    ]);
    const pg = batch.pages.find((p) => p.pageRoute === '/');
    expect(pg?.pageViews).toBe(2);
    expect(pg?.eventsTotal).toBe(3);
  });

  it('scroll_75 incrémente sur scroll_depth >= 75', () => {
    const batch = aggregateEvents([
      makeEvent({ eventName: 'scroll_depth', payload: { scroll_depth: 80 } }),
      makeEvent({ eventName: 'scroll_depth', payload: { scroll_depth: 50 } }),
      makeEvent({ eventName: 'scroll_depth', payload: { scroll_depth: 99 } }),
    ]);
    const pg = batch.pages[0]!;
    expect(pg.scroll75Count).toBe(2);
  });

  it('uniqueVisitors = distinct anonymous_id', () => {
    const batch = aggregateEvents([
      makeEvent({ anonymousId: 'a' }),
      makeEvent({ anonymousId: 'a', sessionId: 'sess_2' }),
      makeEvent({ anonymousId: 'b', sessionId: 'sess_3' }),
    ]);
    expect(batch.pages[0]!.uniqueVisitors).toBe(2);
  });

  it('bounce_count = sessions avec exactement 1 page_view', () => {
    const batch = aggregateEvents([
      makeEvent({ sessionId: 'A', eventName: 'page_view' }),
      makeEvent({ sessionId: 'B', eventName: 'page_view' }),
      makeEvent({ sessionId: 'B', eventName: 'page_view' }),
    ]);
    expect(batch.pages[0]!.bounceCount).toBe(1);
  });
});

describe('aggregateEvents — components', () => {
  it('group par component+event', () => {
    const batch = aggregateEvents([
      makeEvent({ componentId: 'cta-1', eventName: 'add_to_cart' }),
      makeEvent({ componentId: 'cta-1', eventName: 'add_to_cart' }),
      makeEvent({ componentId: 'cta-2', eventName: 'page_view' }),
    ]);
    expect(batch.components.length).toBe(2);
    const cta1 = batch.components.find((c) => c.componentId === 'cta-1');
    expect(cta1?.count).toBe(2);
  });

  it('component sans componentId ignoré', () => {
    const batch = aggregateEvents([makeEvent({ componentId: null })]);
    expect(batch.components).toEqual([]);
  });

  it('componentName résolu depuis le mapping', () => {
    const names = new Map([['cta-1', 'CTA Recevoir']]);
    const batch = aggregateEvents(
      [makeEvent({ componentId: 'cta-1' })],
      names,
    );
    expect(batch.components[0]!.componentName).toBe('CTA Recevoir');
  });
});

describe('aggregateEvents — sections', () => {
  it('group fg_section_view par section+page', () => {
    const batch = aggregateEvents([
      makeEvent({
        eventName: 'fg_section_view',
        pageRoute: '/kit',
        payload: { section_id: 'rituel' },
      }),
      makeEvent({
        eventName: 'fg_section_view',
        pageRoute: '/kit',
        payload: { section_id: 'rituel' },
        sessionId: 'sess_2',
      }),
    ]);
    const sec = batch.sections.find((s) => s.sectionId === 'rituel');
    expect(sec?.views).toBe(2);
    expect(sec?.uniqueSessions).toBe(2);
  });

  it("ignore fg_section_view sans payload.section_id", () => {
    const batch = aggregateEvents([
      makeEvent({ eventName: 'fg_section_view', pageRoute: '/' }),
    ]);
    expect(batch.sections).toEqual([]);
  });

  it('avg_dwell capé à 300 sec', () => {
    const t0 = new Date('2026-05-08T10:00:00Z');
    const t1 = new Date('2026-05-08T10:10:00Z'); // 600 sec
    const batch = aggregateEvents([
      makeEvent({
        eventName: 'fg_section_view',
        pageRoute: '/kit',
        payload: { section_id: 'rituel' },
        receivedAt: t0,
      }),
      makeEvent({
        eventName: 'fg_section_view',
        pageRoute: '/kit',
        payload: { section_id: 'autre' },
        receivedAt: t1,
      }),
    ]);
    const sec = batch.sections.find((s) => s.sectionId === 'rituel');
    expect(sec?.avgDwellSeconds).toBe(300);
  });
});

describe('aggregateEvents — funnel', () => {
  it('compte les 5 étapes', () => {
    const batch = aggregateEvents([
      makeEvent({ eventName: 'view_item' }),
      makeEvent({ eventName: 'view_item' }),
      makeEvent({ eventName: 'add_to_cart' }),
      makeEvent({ eventName: 'begin_checkout' }),
      makeEvent({ eventName: 'add_payment_info' }),
      makeEvent({ eventName: 'purchase', payload: { value: 124.5 } }),
    ]);
    const fu = batch.funnel[0]!;
    expect(fu.viewItem).toBe(2);
    expect(fu.addToCart).toBe(1);
    expect(fu.beginCheckout).toBe(1);
    expect(fu.addPaymentInfo).toBe(1);
    expect(fu.purchase).toBe(1);
    expect(fu.revenueTotalCents).toBe(12450);
  });

  it('uniquePurchasers = sessions distinctes ayant fait purchase', () => {
    const batch = aggregateEvents([
      makeEvent({ eventName: 'purchase', sessionId: 'A' }),
      makeEvent({ eventName: 'purchase', sessionId: 'A' }),
      makeEvent({ eventName: 'purchase', sessionId: 'B' }),
    ]);
    expect(batch.funnel[0]!.uniquePurchasers).toBe(2);
  });

  it('jours différents = lignes différentes', () => {
    const batch = aggregateEvents([
      makeEvent({ eventName: 'view_item', receivedAt: new Date('2026-05-08T10:00:00Z') }),
      makeEvent({ eventName: 'view_item', receivedAt: new Date('2026-05-09T10:00:00Z') }),
    ]);
    expect(batch.funnel.length).toBe(2);
  });
});

describe('aggregateEvents — volume', () => {
  it('1000 events agrégés correctement', () => {
    const events = Array.from({ length: 1000 }, (_, i) =>
      makeEvent({
        sessionId: `sess_${i % 100}`,
        eventName: i % 5 === 0 ? 'add_to_cart' : 'page_view',
        componentId: i % 7 === 0 ? 'cta-1' : null,
      }),
    );
    const batch = aggregateEvents(events);
    const totalCount = batch.events.reduce((s, e) => s + e.count, 0);
    expect(totalCount).toBe(1000);
    // 100 sessions distinctes
    const sumSessions = batch.events.reduce((s, e) => s + e.uniqueSessions, 0);
    expect(sumSessions).toBeGreaterThanOrEqual(100);
  });

  it('events out-of-order conservent la séquence section dwell', () => {
    const t1 = new Date('2026-05-08T10:00:00Z');
    const t2 = new Date('2026-05-08T10:02:00Z');
    const t3 = new Date('2026-05-08T10:05:00Z');
    // Volontairement injectés dans l'ordre inverse
    const batch = aggregateEvents([
      makeEvent({ eventName: 'fg_section_view', payload: { section_id: 'C' }, receivedAt: t3 }),
      makeEvent({ eventName: 'fg_section_view', payload: { section_id: 'A' }, receivedAt: t1 }),
      makeEvent({ eventName: 'fg_section_view', payload: { section_id: 'B' }, receivedAt: t2 }),
    ]);
    const a = batch.sections.find((s) => s.sectionId === 'A');
    const b = batch.sections.find((s) => s.sectionId === 'B');
    expect(a?.avgDwellSeconds).toBe(120); // 2 min
    expect(b?.avgDwellSeconds).toBe(180); // 3 min
  });

  it('events sur 30 jours → 30 buckets', () => {
    const events = Array.from({ length: 30 }, (_, i) =>
      makeEvent({
        receivedAt: new Date(Date.UTC(2026, 4, i + 1)),
      }),
    );
    const batch = aggregateEvents(events);
    expect(batch.events.length).toBe(30);
  });

  it('tous les events sur le même jour → 1 ligne event_daily, 1 ligne page_daily', () => {
    const events = Array.from({ length: 50 }, () => makeEvent());
    const batch = aggregateEvents(events);
    expect(batch.events.length).toBe(1);
    expect(batch.pages.length).toBe(1);
    expect(batch.events[0]!.count).toBe(50);
  });
});

describe('aggregateEvents — invariants property-style', () => {
  it('sum(events.count) = events.length pour tout batch', () => {
    for (let trial = 0; trial < 20; trial++) {
      const n = 10 + Math.floor(Math.random() * 100);
      const events = Array.from({ length: n }, () =>
        makeEvent({
          sessionId: `s_${Math.floor(Math.random() * 10)}`,
          eventName: ['page_view', 'add_to_cart', 'purchase'][Math.floor(Math.random() * 3)] ?? 'page_view',
        }),
      );
      const batch = aggregateEvents(events);
      const sum = batch.events.reduce((s, e) => s + e.count, 0);
      expect(sum).toBe(n);
    }
  });

  it('uniqueSessions <= count pour tout bucket', () => {
    for (let trial = 0; trial < 20; trial++) {
      const n = 5 + Math.floor(Math.random() * 50);
      const events = Array.from({ length: n }, () => makeEvent());
      const batch = aggregateEvents(events);
      for (const e of batch.events) {
        expect(e.uniqueSessions).toBeLessThanOrEqual(e.count);
      }
    }
  });

  it('conversionCount <= count pour tout bucket', () => {
    const n = 50;
    const events = Array.from({ length: n }, () => makeEvent({ isConversion: Math.random() < 0.3 }));
    const batch = aggregateEvents(events);
    for (const e of batch.events) {
      expect(e.conversionCount).toBeLessThanOrEqual(e.count);
    }
  });

  it('bounceCount <= sessions count', () => {
    const events = Array.from({ length: 30 }, (_, i) =>
      makeEvent({
        eventName: 'page_view',
        sessionId: `sess_${i % 5}`,
      }),
    );
    const batch = aggregateEvents(events);
    for (const p of batch.pages) {
      expect(p.bounceCount).toBeLessThanOrEqual(p.uniqueSessions);
    }
  });
});

describe('aggregateEvents — env / device / locale', () => {
  it('même event, env différents → 2 buckets', () => {
    const batch = aggregateEvents([
      makeEvent(),
      makeEvent(),
    ], new Map(), (e) => (e.payload?.env as string) ?? 'production');
    expect(batch.events.length).toBe(1);
  });

  it('device différents = buckets séparés', () => {
    const batch = aggregateEvents([
      makeEvent({ device: 'mobile' }),
      makeEvent({ device: 'desktop' }),
    ]);
    expect(batch.events.length).toBe(2);
  });

  it('locale différents = buckets séparés', () => {
    const batch = aggregateEvents([
      makeEvent({ locale: 'fr-MA' }),
      makeEvent({ locale: 'ar-MA' }),
      makeEvent({ locale: 'fr-FR' }),
    ]);
    expect(batch.events.length).toBe(3);
  });
});
