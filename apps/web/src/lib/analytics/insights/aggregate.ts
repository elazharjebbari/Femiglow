/**
 * Agrégation TypeScript des événements vers les tables `insights_*`.
 *
 * Contrairement aux pré-agrégations Postgres (faites en SQL pour la perf),
 * cette version TS sert de :
 *  - moteur de référence pour les tests unitaires
 *  - moteur de fallback memoryStore (dev local sans Postgres)
 *
 * En production avec Postgres, on bypass ces helpers via les requêtes
 * SQL `INSERT … ON CONFLICT DO UPDATE` (cf. lib/db/queries/insights/refresh-sql.ts).
 *
 * cf. docs/analytics-insights/02-data.md + docs/analytics-insights/07-refresh-orchestration.md
 */
import { createId } from '@/lib/ids';
import type {
  InsightsComponentDailyRow,
  InsightsEventDailyRow,
  InsightsFunnelDailyRow,
  InsightsPageDailyRow,
  InsightsSectionDailyRow,
  TrackingEventLogEntry,
} from '@/lib/db/types';
import { toIsoDate } from './filters';

export interface AggregatedBatch {
  events: InsightsEventDailyRow[];
  pages: InsightsPageDailyRow[];
  components: InsightsComponentDailyRow[];
  sections: InsightsSectionDailyRow[];
  funnel: InsightsFunnelDailyRow[];
}

const SCROLL_DEEP_THRESHOLD = 75;
const FUNNEL_EVENT_NAMES = new Set([
  'view_item',
  'add_to_cart',
  'begin_checkout',
  'add_payment_info',
  'purchase',
  'generate_lead',
]);

export function aggregateEvents(
  events: TrackingEventLogEntry[],
  componentNames: Map<string, string> = new Map(),
  envOf: (e: TrackingEventLogEntry) => string = () => 'production',
): AggregatedBatch {
  const eventBuckets = new Map<string, InsightsEventDailyRow>();
  const pageBuckets = new Map<string, InsightsPageDailyRow>();
  const componentBuckets = new Map<string, InsightsComponentDailyRow>();
  const sectionBuckets = new Map<string, InsightsSectionDailyRow>();
  const funnelBuckets = new Map<string, InsightsFunnelDailyRow>();

  // Pour les sections : on a besoin de l'ordre des events par session.
  const sectionViewsBySession = new Map<
    string,
    { sessionId: string; receivedAt: Date; pageRoute: string; sectionId: string }[]
  >();

  // Pour bounce / avg time : agréger par session+page.
  type SessionPageStat = {
    pageViews: number;
    firstAt: number;
    lastAt: number;
  };
  const sessionPageStats = new Map<string, Map<string, SessionPageStat>>();

  // Pour unique_sessions : track distinct sessions par bucket.
  const eventSessions = new Map<string, Set<string>>();
  const pageSessions = new Map<string, Set<string>>();
  const pageVisitors = new Map<string, Set<string>>();
  const componentSessions = new Map<string, Set<string>>();
  const sectionSessions = new Map<string, Set<string>>();
  const purchaseSessions = new Map<string, Set<string>>();

  for (const e of events) {
    const date = toIsoDate(e.receivedAt);
    const env = envOf(e);
    const evKey = `${date}|${e.eventName}|${env}|${e.device}|${e.locale}`;
    const existingEv = eventBuckets.get(evKey);
    const evRow: InsightsEventDailyRow = existingEv ?? {
      id: createId('iev'),
      date,
      eventName: e.eventName,
      eventCategory: e.eventCategory ?? 'unknown',
      env,
      device: e.device,
      locale: e.locale,
      count: 0,
      uniqueSessions: 0,
      conversionCount: 0,
      refreshedAt: new Date(),
    };
    evRow.count += 1;
    if (e.isConversion) evRow.conversionCount += 1;
    eventBuckets.set(evKey, evRow);
    const evSessSet = eventSessions.get(evKey) ?? new Set<string>();
    evSessSet.add(e.sessionId);
    eventSessions.set(evKey, evSessSet);

    // Pages
    if (e.pageRoute) {
      const pgKey = `${date}|${e.pageRoute}`;
      const existingPg = pageBuckets.get(pgKey);
      const pgRow: InsightsPageDailyRow = existingPg ?? {
        id: createId('ipa'),
        date,
        pageRoute: e.pageRoute,
        pageViews: 0,
        uniqueSessions: 0,
        uniqueVisitors: 0,
        eventsTotal: 0,
        scroll75Count: 0,
        conversions: 0,
        bounceCount: 0,
        avgTimeSeconds: 0,
        refreshedAt: new Date(),
      };
      pgRow.eventsTotal += 1;
      if (e.eventName === 'page_view') pgRow.pageViews += 1;
      if (e.isConversion) pgRow.conversions += 1;
      const scrollDepth = pickNumber(e.payload, 'scroll_depth', 'scrollDepth');
      if (
        e.eventName === 'scroll_depth' &&
        scrollDepth !== null &&
        scrollDepth >= SCROLL_DEEP_THRESHOLD
      ) {
        pgRow.scroll75Count += 1;
      }
      pageBuckets.set(pgKey, pgRow);
      addToSet(pageSessions, pgKey, e.sessionId);
      addToSet(pageVisitors, pgKey, e.anonymousId);

      // Stats par session+page (pour bounce + avg time)
      const stats = sessionPageStats.get(e.sessionId) ?? new Map<string, SessionPageStat>();
      const t = e.receivedAt.getTime();
      const ps = stats.get(pgKey) ?? { pageViews: 0, firstAt: t, lastAt: t };
      if (e.eventName === 'page_view') ps.pageViews += 1;
      if (t < ps.firstAt) ps.firstAt = t;
      if (t > ps.lastAt) ps.lastAt = t;
      stats.set(pgKey, ps);
      sessionPageStats.set(e.sessionId, stats);
    }

    // Components
    if (e.componentId) {
      const cmpKey = `${date}|${e.componentId}|${e.eventName}|${e.pageRoute ?? ''}`;
      const existingCmp = componentBuckets.get(cmpKey);
      const cmpRow: InsightsComponentDailyRow = existingCmp ?? {
        id: createId('ico'),
        date,
        componentId: e.componentId,
        componentName: componentNames.get(e.componentId) ?? null,
        pageRoute: e.pageRoute ?? null,
        eventName: e.eventName,
        count: 0,
        uniqueSessions: 0,
        conversionCount: 0,
        refreshedAt: new Date(),
      };
      cmpRow.count += 1;
      if (e.isConversion) cmpRow.conversionCount += 1;
      componentBuckets.set(cmpKey, cmpRow);
      addToSet(componentSessions, cmpKey, e.sessionId);
    }

    // Sections (event = fg_section_view, payload.section_id)
    if (e.eventName === 'fg_section_view' && e.pageRoute) {
      const sectionId = pickString(e.payload, 'section_id', 'sectionId');
      if (sectionId) {
        const seKey = `${date}|${e.pageRoute}|${sectionId}`;
        const existingSe = sectionBuckets.get(seKey);
        const seRow: InsightsSectionDailyRow = existingSe ?? {
          id: createId('ise'),
          date,
          pageRoute: e.pageRoute,
          sectionId,
          views: 0,
          avgDwellSeconds: 0,
          uniqueSessions: 0,
          refreshedAt: new Date(),
        };
        seRow.views += 1;
        sectionBuckets.set(seKey, seRow);
        addToSet(sectionSessions, seKey, e.sessionId);

        const arr = sectionViewsBySession.get(e.sessionId) ?? [];
        arr.push({ sessionId: e.sessionId, receivedAt: e.receivedAt, pageRoute: e.pageRoute, sectionId });
        sectionViewsBySession.set(e.sessionId, arr);
      }
    }

    // Funnel
    if (FUNNEL_EVENT_NAMES.has(e.eventName)) {
      const fuKey = date;
      const existingFu = funnelBuckets.get(fuKey);
      const fuRow: InsightsFunnelDailyRow = existingFu ?? {
        id: createId('ifu'),
        date,
        viewItem: 0,
        addToCart: 0,
        beginCheckout: 0,
        addPaymentInfo: 0,
        purchase: 0,
        generateLead: 0,
        uniquePurchasers: 0,
        revenueTotalCents: 0,
        refreshedAt: new Date(),
      };
      switch (e.eventName) {
        case 'view_item':
          fuRow.viewItem += 1;
          break;
        case 'add_to_cart':
          fuRow.addToCart += 1;
          break;
        case 'begin_checkout':
          fuRow.beginCheckout += 1;
          break;
        case 'add_payment_info':
          fuRow.addPaymentInfo += 1;
          break;
        case 'purchase': {
          fuRow.purchase += 1;
          const value = pickNumber(e.payload, 'value', 'revenue', 'amount');
          if (value !== null) fuRow.revenueTotalCents += Math.round(value * 100);
          addToSet(purchaseSessions, fuKey, e.sessionId);
          break;
        }
        case 'generate_lead':
          fuRow.generateLead += 1;
          break;
      }
      funnelBuckets.set(fuKey, fuRow);
    }
  }

  // Reconciliation : unique_sessions / visitors / dwell time / bounce / avg_time
  for (const [k, set] of eventSessions) {
    const r = eventBuckets.get(k);
    if (r) r.uniqueSessions = set.size;
  }
  for (const [k, set] of pageSessions) {
    const r = pageBuckets.get(k);
    if (r) r.uniqueSessions = set.size;
  }
  for (const [k, set] of pageVisitors) {
    const r = pageBuckets.get(k);
    if (r) r.uniqueVisitors = set.size;
  }
  for (const [k, set] of componentSessions) {
    const r = componentBuckets.get(k);
    if (r) r.uniqueSessions = set.size;
  }
  for (const [k, set] of sectionSessions) {
    const r = sectionBuckets.get(k);
    if (r) r.uniqueSessions = set.size;
  }
  for (const [k, set] of purchaseSessions) {
    const r = funnelBuckets.get(k);
    if (r) r.uniquePurchasers = set.size;
  }

  // Bounce + avg time : recalculer pour chaque page row
  // bounceCount = nb sessions ayant exactement 1 page_view sur cette page.
  // avgTimeSeconds = moyenne (lastAt - firstAt) / 1000 sur les sessions avec ≥ 2 events sur la page.
  const pageStats = new Map<string, { bounce: number; total: number; durations: number[] }>();
  for (const [, stats] of sessionPageStats) {
    for (const [pgKey, ps] of stats) {
      const agg = pageStats.get(pgKey) ?? { bounce: 0, total: 0, durations: [] };
      if (ps.pageViews === 1) agg.bounce += 1;
      agg.total += 1;
      const dwellSec = (ps.lastAt - ps.firstAt) / 1000;
      if (dwellSec > 0 && dwellSec < 1800) agg.durations.push(dwellSec);
      pageStats.set(pgKey, agg);
    }
  }
  for (const [k, agg] of pageStats) {
    const r = pageBuckets.get(k);
    if (r) {
      r.bounceCount = agg.bounce;
      if (agg.durations.length > 0) {
        const sum = agg.durations.reduce((a, b) => a + b, 0);
        r.avgTimeSeconds = Math.round(sum / agg.durations.length);
      }
    }
  }

  // Section dwell time : on prend l'écart entre deux fg_section_view consécutives
  // d'une même session. Cap à 5 minutes.
  for (const arr of sectionViewsBySession.values()) {
    arr.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
    for (let i = 0; i < arr.length; i++) {
      const cur = arr[i];
      if (!cur) continue;
      const next = arr[i + 1];
      const dwellMs = next ? next.receivedAt.getTime() - cur.receivedAt.getTime() : 0;
      const dwellSec = Math.min(Math.max(dwellMs / 1000, 0), 300);
      const key = `${toIsoDate(cur.receivedAt)}|${cur.pageRoute}|${cur.sectionId}`;
      const row = sectionBuckets.get(key);
      if (row) {
        // Stocker temporaire : on accumule, on divisera après
        row.avgDwellSeconds += dwellSec;
      }
    }
  }
  // Diviser par views pour obtenir la moyenne
  for (const row of sectionBuckets.values()) {
    if (row.views > 0) row.avgDwellSeconds = Math.round(row.avgDwellSeconds / row.views);
  }

  return {
    events: Array.from(eventBuckets.values()),
    pages: Array.from(pageBuckets.values()),
    components: Array.from(componentBuckets.values()),
    sections: Array.from(sectionBuckets.values()),
    funnel: Array.from(funnelBuckets.values()),
  };
}

function addToSet<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  const s = map.get(key) ?? new Set<V>();
  s.add(value);
  map.set(key, s);
}

function pickString(obj: Record<string, unknown> | null | undefined, ...keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

function pickNumber(obj: Record<string, unknown> | null | undefined, ...keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}
