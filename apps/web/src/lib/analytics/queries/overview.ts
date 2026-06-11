/**
 * Queries pour l'onglet "Vue d'ensemble".
 * cf. docs/analytics/05-onglets-specs.md §1
 *
 * Fournit :
 *  - KPI principaux (sessions, visitors, page_views, avg_session_duration,
 *    bounce_rate, conversion_rate) avec valeurs comparées.
 *  - Série temporelle des sessions (bucketée hour/day/week).
 *  - Top sources de trafic (bucket attribution).
 *  - Top pages (par page_views).
 *
 * Implémentation pragmatique : en mémoire (memoryStore) pour les tests/dev,
 * fallback sur scan complet du log tracking. Les matviews `mv_overview_hourly`
 * sont privilégiées via Drizzle quand DATABASE_URL est défini, mais on conserve
 * la fonction de calcul TS pour les environnements sans Postgres.
 */
import { db, memoryStore, schema } from '@/lib/db/client';
import type { TrackingEventLogEntry } from '@/lib/db/types';
import { sql } from 'drizzle-orm';

import { classifyTraffic, type TrafficBucket } from '../attribution';
import type { AnalyticsFilters } from '../filters';
import { resolveRange } from '../filters';
import { suggestGranularity } from '../format';

export interface OverviewKpi {
  current: number | null;
  previous: number | null;
  /** Variation relative (ex: 0.124 = +12,4 %). null si previous=0/null. */
  delta: number | null;
}

export interface OverviewBucketPoint {
  bucket: string; // ISO timestamp début du bucket
  sessions: number;
  pageViews: number;
}

export interface OverviewSourceRow {
  source: TrafficBucket;
  sessions: number;
  conversionRate: number | null;
}

export interface OverviewPageRow {
  pageRoute: string;
  pageViews: number;
  sessions: number;
}

export interface OverviewData {
  range: { from: string; to: string; granularity: 'hour' | 'day' | 'week' };
  kpis: {
    sessions: OverviewKpi;
    uniqueVisitors: OverviewKpi;
    pageViews: OverviewKpi;
    avgSessionDuration: OverviewKpi; // en secondes
    bounceRate: OverviewKpi; // ratio 0..1
    conversionRate: OverviewKpi; // ratio 0..1
  };
  series: OverviewBucketPoint[];
  topSources: OverviewSourceRow[];
  topPages: OverviewPageRow[];
}

interface ComputeContext {
  events: TrackingEventLogEntry[];
  from: Date;
  to: Date;
}

/* ─────────────────────────────────────────────────────────────────────
 * Public entrypoint
 * ───────────────────────────────────────────────────────────────────── */

export async function getOverviewData(
  filters: AnalyticsFilters,
  now: Date = new Date(),
): Promise<OverviewData> {
  const range = resolveRange(filters, now);
  const granularity = suggestGranularity(range.to.getTime() - range.from.getTime());

  // Fetch full window (current + previous) for delta calc.
  const fetchFrom = range.comparisonFrom;
  const fetchTo = range.to;

  const events = await fetchEvents({
    from: fetchFrom,
    to: fetchTo,
    device: filters.device === 'all' ? undefined : filters.device,
    traffic: filters.traffic === 'all' ? undefined : filters.traffic,
  });

  const currentCtx: ComputeContext = {
    events: events.filter((e) => e.receivedAt >= range.from && e.receivedAt < range.to),
    from: range.from,
    to: range.to,
  };
  const previousCtx: ComputeContext = {
    events: events.filter(
      (e) => e.receivedAt >= range.comparisonFrom && e.receivedAt < range.comparisonTo,
    ),
    from: range.comparisonFrom,
    to: range.comparisonTo,
  };

  return {
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      granularity,
    },
    kpis: {
      sessions: kpi(countSessions(currentCtx), countSessions(previousCtx)),
      uniqueVisitors: kpi(countVisitors(currentCtx), countVisitors(previousCtx)),
      pageViews: kpi(countPageViews(currentCtx), countPageViews(previousCtx)),
      avgSessionDuration: kpi(
        avgSessionDuration(currentCtx),
        avgSessionDuration(previousCtx),
      ),
      bounceRate: kpi(bounceRate(currentCtx), bounceRate(previousCtx)),
      conversionRate: kpi(
        conversionRate(currentCtx),
        conversionRate(previousCtx),
      ),
    },
    series: buildSeries(currentCtx, granularity),
    topSources: topSources(currentCtx),
    topPages: topPages(currentCtx),
  };
}

/* ─────────────────────────────────────────────────────────────────────
 * Fetching
 * ───────────────────────────────────────────────────────────────────── */

interface FetchOpts {
  from: Date;
  to: Date;
  device?: string;
  traffic?: string;
}

async function fetchEvents(opts: FetchOpts): Promise<TrackingEventLogEntry[]> {
  const drizzle = db();
  if (drizzle) {
    // On construit la WHERE clause en composant des fragments `sql\`...\``
    // pour bénéficier du binding paramétré de Drizzle. L'ancienne
    // implémentation utilisait `sql.raw()` avec des placeholders `$1`/`$2`
    // mais NE passait jamais les valeurs → la requête échouait avec
    // `params: ` vide. `sql.raw()` ne supporte pas le param binding ;
    // il faut utiliser des template tags.
    //
    // NOTE : `postgres-js` n'accepte pas un `Date` natif comme paramètre
    // lié (il appelle `Buffer.byteLength()` dessus → TypeError). On
    // convertit donc explicitement les bornes en ISO string ; PostgreSQL
    // sait parser les ISO 8601 vers `timestamptz` côté serveur.
    const conditions = [
      sql`received_at >= ${opts.from.toISOString()}`,
      sql`received_at < ${opts.to.toISOString()}`,
      // AN-07 : cohérence inter-onglets — Overview filtre le consentement
      // analytics comme funnel/cta/checkout (sinon KPI calculés sur un dataset
      // différent des autres onglets).
      sql`consent_snapshot->>'analytics_storage' = 'granted'`,
    ];
    if (opts.device) {
      conditions.push(sql`device = ${opts.device}`);
    }
    if (opts.traffic) {
      conditions.push(sql`traffic_source = ${opts.traffic}`);
    }
    const where = sql.join(conditions, sql` AND `);

    const rows = await drizzle.execute(sql`
      SELECT id, event_id, event_name, event_category, page_id, component_id,
             page_route, anonymous_id, session_id, user_id, consent_snapshot,
             payload, ua_hash, ip_anonymized, device, locale, is_conversion,
             providers_dispatched, providers_results, received_at, schema_version,
             traffic_source, traffic_medium, experiment_id, experiment_variant
      FROM tracking_events_log
      WHERE ${where}
      ORDER BY received_at ASC
    `);
    return (rows as unknown as Record<string, unknown>[]).map(rowToEntry);
  }

  // memoryStore
  const store = memoryStore();
  let entries = Array.from(store.trackingEventsLog.values());
  entries = entries.filter(
    (e) =>
      e.receivedAt >= opts.from &&
      e.receivedAt < opts.to &&
      e.consentSnapshot?.analytics_storage === 'granted', // AN-07
  );
  if (opts.device) entries = entries.filter((e) => e.device === opts.device);
  if (opts.traffic) {
    entries = entries.filter((e) => trafficOf(e) === opts.traffic);
  }
  entries.sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
  return entries;
}

function rowToEntry(row: Record<string, unknown>): TrackingEventLogEntry {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    eventName: String(row.event_name),
    eventCategory: row.event_category as TrackingEventLogEntry['eventCategory'],
    pageId: (row.page_id as string | null) ?? null,
    componentId: (row.component_id as string | null) ?? null,
    pageRoute: String(row.page_route),
    anonymousId: String(row.anonymous_id),
    sessionId: String(row.session_id),
    userId: (row.user_id as string | null) ?? null,
    consentSnapshot: row.consent_snapshot as TrackingEventLogEntry['consentSnapshot'],
    payload: (row.payload as Record<string, unknown>) ?? {},
    uaHash: String(row.ua_hash),
    ipAnonymized: String(row.ip_anonymized),
    device: row.device as TrackingEventLogEntry['device'],
    locale: String(row.locale),
    isConversion: Boolean(row.is_conversion),
    providersDispatched: (row.providers_dispatched as string[]) ?? [],
    providersResults:
      (row.providers_results as TrackingEventLogEntry['providersResults']) ?? {},
    receivedAt: new Date(row.received_at as string | number | Date),
    schemaVersion: Number(row.schema_version ?? 1),
    trafficSource: (row.traffic_source as string | null) ?? null,
    trafficMedium: (row.traffic_medium as string | null) ?? null,
    experimentId: (row.experiment_id as string | null) ?? null,
    experimentVariant: (row.experiment_variant as string | null) ?? null,
  };
}

/* ─────────────────────────────────────────────────────────────────────
 * Compute helpers
 * ───────────────────────────────────────────────────────────────────── */

/**
 * AN-01 : événements comptant comme « vue de page ». L'app FemiGlow n'émet pas
 * de `page_view` générique mais un `view_item` par page produit (/kit). On
 * reconnaît donc les deux comme signal de page-vue pour le rebond, les top
 * pages, la série et le KPI pageViews — sinon ces métriques restent à 0/vide.
 */
const PAGE_VIEW_EVENTS = new Set(['page_view', 'view_item']);
function isPageViewEvent(e: TrackingEventLogEntry): boolean {
  return PAGE_VIEW_EVENTS.has(e.eventName);
}

function countSessions(ctx: ComputeContext): number {
  return new Set(ctx.events.map((e) => e.sessionId)).size;
}

function countVisitors(ctx: ComputeContext): number {
  return new Set(ctx.events.map((e) => e.anonymousId)).size;
}

function countPageViews(ctx: ComputeContext): number {
  return ctx.events.filter(isPageViewEvent).length;
}

function avgSessionDuration(ctx: ComputeContext): number | null {
  const bySession = new Map<string, { first: number; last: number }>();
  for (const e of ctx.events) {
    const t = e.receivedAt.getTime();
    const cur = bySession.get(e.sessionId);
    if (!cur) bySession.set(e.sessionId, { first: t, last: t });
    else {
      if (t < cur.first) cur.first = t;
      if (t > cur.last) cur.last = t;
    }
  }
  if (bySession.size === 0) return null;
  let total = 0;
  for (const s of bySession.values()) total += (s.last - s.first) / 1000;
  return total / bySession.size;
}

function bounceRate(ctx: ComputeContext): number | null {
  const sessionPageViews = new Map<string, number>();
  for (const e of ctx.events) {
    if (!isPageViewEvent(e)) continue;
    sessionPageViews.set(e.sessionId, (sessionPageViews.get(e.sessionId) ?? 0) + 1);
  }
  if (sessionPageViews.size === 0) return null;
  let bounced = 0;
  for (const c of sessionPageViews.values()) if (c <= 1) bounced += 1;
  return bounced / sessionPageViews.size;
}

function conversionRate(ctx: ComputeContext): number | null {
  const sessions = new Set(ctx.events.map((e) => e.sessionId));
  if (sessions.size === 0) return null;
  const converted = new Set(
    ctx.events.filter((e) => e.isConversion).map((e) => e.sessionId),
  );
  return converted.size / sessions.size;
}

function kpi(current: number | null, previous: number | null): OverviewKpi {
  let delta: number | null = null;
  if (current !== null && previous !== null && previous !== 0) {
    delta = (current - previous) / previous;
  }
  return { current, previous, delta };
}

function buildSeries(
  ctx: ComputeContext,
  granularity: 'hour' | 'day' | 'week',
): OverviewBucketPoint[] {
  const buckets = new Map<string, { sessions: Set<string>; pv: number }>();
  for (const e of ctx.events) {
    const key = bucketKey(e.receivedAt, granularity);
    const b = buckets.get(key) ?? { sessions: new Set<string>(), pv: 0 };
    b.sessions.add(e.sessionId);
    if (isPageViewEvent(e)) b.pv += 1;
    buckets.set(key, b);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([bucket, v]) => ({
      bucket,
      sessions: v.sessions.size,
      pageViews: v.pv,
    }));
}

function bucketKey(d: Date, granularity: 'hour' | 'day' | 'week'): string {
  const c = new Date(d);
  switch (granularity) {
    case 'hour':
      c.setMinutes(0, 0, 0);
      return c.toISOString();
    case 'day':
      c.setHours(0, 0, 0, 0);
      return c.toISOString();
    case 'week': {
      // start of ISO week (Monday)
      const day = (c.getDay() + 6) % 7;
      c.setDate(c.getDate() - day);
      c.setHours(0, 0, 0, 0);
      return c.toISOString();
    }
  }
}

function topSources(ctx: ComputeContext, limit = 10): OverviewSourceRow[] {
  const bySource = new Map<TrafficBucket, { sessions: Set<string>; converted: Set<string> }>();
  for (const e of ctx.events) {
    const source = (trafficOf(e) ?? 'direct') as TrafficBucket;
    const b = bySource.get(source) ?? {
      sessions: new Set<string>(),
      converted: new Set<string>(),
    };
    b.sessions.add(e.sessionId);
    if (e.isConversion) b.converted.add(e.sessionId);
    bySource.set(source, b);
  }
  return Array.from(bySource.entries())
    .map(([source, v]) => ({
      source,
      sessions: v.sessions.size,
      conversionRate: v.sessions.size > 0 ? v.converted.size / v.sessions.size : null,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, limit);
}

function topPages(ctx: ComputeContext, limit = 10): OverviewPageRow[] {
  const byPage = new Map<string, { pv: number; sessions: Set<string> }>();
  for (const e of ctx.events) {
    if (!isPageViewEvent(e)) continue;
    const r = byPage.get(e.pageRoute) ?? { pv: 0, sessions: new Set<string>() };
    r.pv += 1;
    r.sessions.add(e.sessionId);
    byPage.set(e.pageRoute, r);
  }
  return Array.from(byPage.entries())
    .map(([pageRoute, v]) => ({
      pageRoute,
      pageViews: v.pv,
      sessions: v.sessions.size,
    }))
    .sort((a, b) => b.pageViews - a.pageViews)
    .slice(0, limit);
}

/**
 * Détermine le bucket de trafic d'un événement.
 * Priorité : trafficSource (résolu en M0 backfill) > classification on-the-fly
 * depuis le payload (utm/referrer).
 */
function trafficOf(e: TrackingEventLogEntry): TrafficBucket | null {
  if (e.trafficSource) {
    return e.trafficSource as TrafficBucket;
  }
  const p = e.payload ?? {};
  const referrer = pickStr(p, 'referrer') ?? null;
  const result = classifyTraffic({
    utm: {
      utm_source: pickStr(p, 'utm_source', 'utmSource') ?? null,
      utm_medium: pickStr(p, 'utm_medium', 'utmMedium') ?? null,
      utm_campaign: pickStr(p, 'utm_campaign', 'utmCampaign') ?? null,
    },
    referrer,
  });
  return result.source;
}

function pickStr(
  obj: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}
