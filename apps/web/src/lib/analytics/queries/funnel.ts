/**
 * Queries pour l'onglet "Funnel".
 * cf. docs/analytics/05-onglets-specs.md §3 et docs/analytics/03-events-funnel-audit.md
 *
 * 5 étapes session-level : View → Engage → CTA → Checkout → Purchase. Chaque
 * step est `BOOL_OR(...)` agrégé par session — donc indépendant des doublons et
 * de l'ordre. Seul le passage entre étapes adjacentes définit le drop-off.
 *
 * On expose 3 entrées :
 *  - `getFunnelOverview(filters)` : steps + drop-offs + médianes time-to-next.
 *  - `getFunnelByPage(filters)` : DataTable « par page d'entrée ».
 *  - `getFunnelSankey(filters)` : flux first_page → step max atteint, top 20.
 *
 * Implémentation : memoryStore quand pas de DATABASE_URL (tests/dev), sinon
 * scan `tracking_events_log` filtré par consent + période + device + traffic.
 */
import { sql } from 'drizzle-orm';

import { db, memoryStore } from '@/lib/db/client';
import type { TrackingEventLogEntry } from '@/lib/db/types';

import { classifyTraffic, type TrafficBucket } from '../attribution';
import type { AnalyticsFilters } from '../filters';
import { resolveRange } from '../filters';
import { analyticsCacheTtlMs, getCachedAnalytics, setCachedAnalytics } from '../cache';

export const FUNNEL_STAGES = [
  'view',
  'engage',
  'cta',
  'checkout',
  'purchase',
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export interface FunnelStep {
  stage: FunnelStage;
  sessions: number;
  /** Ratio step_n / step_(n-1). null pour la 1ère étape. */
  progressionFromPrevious: number | null;
  /** 1 - step_(n+1)/step_n. null pour la dernière étape. */
  dropoffToNext: number | null;
  /** Médiane time-to-next-step en secondes (calculée par session). null si N/A. */
  medianTimeToNextSeconds: number | null;
}

export interface FunnelByPageRow {
  pageRoute: string;
  views: number;
  /** views → cta (ratio). null si views=0. */
  viewToCta: number | null;
  /** cta → purchase (ratio). null si cta=0. */
  ctaToBuy: number | null;
  /** Volume final (purchase). */
  purchases: number;
}

export interface FunnelSankeyLink {
  firstPage: string;
  /** Stage MAX atteint (les sessions qui ont atteint `cta` p.ex. n'apparaissent
   *  qu'une fois sous "cta", pas en plus sous "view" ni "engage"). */
  reachedStage: FunnelStage;
  volume: number;
}

export interface FunnelOverviewData {
  range: { from: string; to: string };
  steps: FunnelStep[];
  /** Total sessions distinctes (pour la mise en contexte « tu as vu N sessions »). */
  totalSessions: number;
}

export interface FunnelByPageData {
  range: { from: string; to: string };
  rows: FunnelByPageRow[];
}

export interface FunnelSankeyData {
  range: { from: string; to: string };
  /** Top 20 first_page distincts ; le reste agrégé en "Autres". */
  links: FunnelSankeyLink[];
  truncated: boolean;
}

/* ─────────────────────────────────────────────────────────────────────
 * Stage classification
 * ───────────────────────────────────────────────────────────────────── */

const STAGE_RANK: Record<FunnelStage, number> = {
  view: 1,
  engage: 2,
  cta: 3,
  checkout: 4,
  purchase: 5,
};

interface SessionFlags {
  view: boolean;
  engage: boolean;
  cta: boolean;
  checkout: boolean;
  purchase: boolean;
  /** Première page enregistrée sur la session (ordre receivedAt asc). */
  firstPage: string | null;
  firstPageTs: number;
  /** Timestamps min par stage, pour median time-to-next. */
  stageFirstTs: Partial<Record<FunnelStage, number>>;
}

/** True si l'event compte pour le stage « engage ». */
function isEngageEvent(eventName: string): boolean {
  return (
    eventName === 'scroll_depth_50' ||
    eventName === 'video_user_play' ||
    eventName === 'cta_impression'
  );
}

/** True si l'event compte pour le stage « cta » (intention d'achat). */
function isCtaEvent(e: TrackingEventLogEntry): boolean {
  if (e.eventName === 'add_to_cart') return true;
  if (e.eventName === 'cta_click') {
    const intent = readStr(e.payload, 'cta_intent');
    return intent === 'purchase';
  }
  return false;
}

/** True si l'event compte pour le stage « view » (vue produit / kit). */
function isViewEvent(e: TrackingEventLogEntry): boolean {
  if (e.eventName === 'view_item') return true;
  if (e.eventName === 'page_view') {
    return e.pageRoute === '/kit' || e.pageRoute.startsWith('/kit/');
  }
  return false;
}

function classifyStage(e: TrackingEventLogEntry): FunnelStage | null {
  if (e.eventName === 'purchase') return 'purchase';
  if (e.eventName === 'begin_checkout') return 'checkout';
  if (isCtaEvent(e)) return 'cta';
  if (isEngageEvent(e.eventName)) return 'engage';
  if (isViewEvent(e)) return 'view';
  return null;
}

/* ─────────────────────────────────────────────────────────────────────
 * Public entrypoints
 * ───────────────────────────────────────────────────────────────────── */

export async function getFunnelOverview(
  filters: AnalyticsFilters,
  now: Date = new Date(),
): Promise<FunnelOverviewData> {
  const range = resolveRange(filters, now);
  const ttl = analyticsCacheTtlMs(range);
  const cacheKey = `funnel-overview:${JSON.stringify(filters)}`;
  const cached = getCachedAnalytics<FunnelOverviewData>(cacheKey, ttl, now.getTime());
  if (cached) return cached;
  const events = await fetchEvents({
    from: range.from,
    to: range.to,
    device: filters.device === 'all' ? undefined : filters.device,
    traffic: filters.traffic === 'all' ? undefined : filters.traffic,
  });
  const sessions = aggregateSessions(events);

  const stepCounts: Record<FunnelStage, number> = {
    view: 0,
    engage: 0,
    cta: 0,
    checkout: 0,
    purchase: 0,
  };
  // Funnel cumulatif strict : pour passer au step N, il faut tous les steps < N.
  // Ex : `cta` comptabilise les sessions { view ∧ engage ∧ cta }.
  const timesToNext: Record<FunnelStage, number[]> = {
    view: [],
    engage: [],
    cta: [],
    checkout: [],
    purchase: [],
  };

  for (const s of sessions.values()) {
    const reached: Record<FunnelStage, boolean> = {
      view: s.view,
      engage: s.view && s.engage,
      cta: s.view && s.engage && s.cta,
      checkout: s.view && s.engage && s.cta && s.checkout,
      purchase: s.view && s.engage && s.cta && s.checkout && s.purchase,
    };
    for (const stage of FUNNEL_STAGES) {
      if (reached[stage]) stepCounts[stage] += 1;
    }
    // time to next = min(stage_(n+1).ts) - min(stage_n.ts) pour chaque adj.
    for (let i = 0; i < FUNNEL_STAGES.length - 1; i += 1) {
      const a = FUNNEL_STAGES[i]!;
      const b = FUNNEL_STAGES[i + 1]!;
      const ta = s.stageFirstTs[a];
      const tb = s.stageFirstTs[b];
      if (reached[a] && reached[b] && ta !== undefined && tb !== undefined && tb >= ta) {
        timesToNext[a].push((tb - ta) / 1000);
      }
    }
  }

  const steps: FunnelStep[] = FUNNEL_STAGES.map((stage, idx) => {
    const cur = stepCounts[stage];
    const prev = idx > 0 ? stepCounts[FUNNEL_STAGES[idx - 1]!] : null;
    const next = idx < FUNNEL_STAGES.length - 1
      ? stepCounts[FUNNEL_STAGES[idx + 1]!]
      : null;
    return {
      stage,
      sessions: cur,
      progressionFromPrevious:
        prev !== null && prev > 0 ? cur / prev : null,
      dropoffToNext:
        next !== null && cur > 0 ? 1 - next / cur : null,
      medianTimeToNextSeconds: median(timesToNext[stage]),
    };
  });

  const result: FunnelOverviewData = {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    steps,
    totalSessions: sessions.size,
  };
  setCachedAnalytics(cacheKey, result, ttl, now.getTime());
  return result;
}

export async function getFunnelByPage(
  filters: AnalyticsFilters,
  now: Date = new Date(),
): Promise<FunnelByPageData> {
  const range = resolveRange(filters, now);
  const events = await fetchEvents({
    from: range.from,
    to: range.to,
    device: filters.device === 'all' ? undefined : filters.device,
    traffic: filters.traffic === 'all' ? undefined : filters.traffic,
  });
  const sessions = aggregateSessions(events);

  // Indexé par firstPage.
  const byPage = new Map<
    string,
    { views: number; ctas: number; purchases: number }
  >();
  for (const s of sessions.values()) {
    const page = s.firstPage ?? '/';
    const acc = byPage.get(page) ?? { views: 0, ctas: 0, purchases: 0 };
    if (s.view) acc.views += 1;
    if (s.view && s.engage && s.cta) acc.ctas += 1;
    if (s.view && s.engage && s.cta && s.checkout && s.purchase) acc.purchases += 1;
    byPage.set(page, acc);
  }

  const rows: FunnelByPageRow[] = Array.from(byPage.entries())
    .filter(([, v]) => v.views > 0)
    .map(([pageRoute, v]) => ({
      pageRoute,
      views: v.views,
      viewToCta: v.views > 0 ? v.ctas / v.views : null,
      ctaToBuy: v.ctas > 0 ? v.purchases / v.ctas : null,
      purchases: v.purchases,
    }))
    .sort((a, b) => b.views - a.views);

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    rows,
  };
}

export async function getFunnelSankey(
  filters: AnalyticsFilters,
  now: Date = new Date(),
  topN = 20,
): Promise<FunnelSankeyData> {
  const range = resolveRange(filters, now);
  const events = await fetchEvents({
    from: range.from,
    to: range.to,
    device: filters.device === 'all' ? undefined : filters.device,
    traffic: filters.traffic === 'all' ? undefined : filters.traffic,
  });
  const sessions = aggregateSessions(events);

  // 1) classement des first_page par volume desc, top N — au-delà → "Autres".
  const volumeByPage = new Map<string, number>();
  for (const s of sessions.values()) {
    const page = s.firstPage ?? '/';
    volumeByPage.set(page, (volumeByPage.get(page) ?? 0) + 1);
  }
  const ordered = Array.from(volumeByPage.entries()).sort((a, b) => b[1] - a[1]);
  const visiblePages = new Set(ordered.slice(0, topN).map(([k]) => k));
  const truncated = ordered.length > topN;

  // 2) flux : firstPage (ou "Autres") × stage atteint MAX.
  const linkMap = new Map<string, number>();
  for (const s of sessions.values()) {
    const reachedStage: FunnelStage = (() => {
      if (s.view && s.engage && s.cta && s.checkout && s.purchase) return 'purchase';
      if (s.view && s.engage && s.cta && s.checkout) return 'checkout';
      if (s.view && s.engage && s.cta) return 'cta';
      if (s.view && s.engage) return 'engage';
      return 'view';
    })();
    if (!s.view) continue; // sessions sans view exclues du Sankey
    const rawPage = s.firstPage ?? '/';
    const page = visiblePages.has(rawPage) ? rawPage : 'Autres';
    const key = `${page}|${reachedStage}`;
    linkMap.set(key, (linkMap.get(key) ?? 0) + 1);
  }

  const links: FunnelSankeyLink[] = Array.from(linkMap.entries())
    .map(([key, volume]) => {
      const [firstPage, reachedStage] = key.split('|') as [string, FunnelStage];
      return { firstPage, reachedStage, volume };
    })
    .sort((a, b) => {
      if (a.firstPage !== b.firstPage) return a.firstPage.localeCompare(b.firstPage);
      return STAGE_RANK[a.reachedStage] - STAGE_RANK[b.reachedStage];
    });

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    links,
    truncated,
  };
}

/* ─────────────────────────────────────────────────────────────────────
 * Aggregation helpers
 * ───────────────────────────────────────────────────────────────────── */

function aggregateSessions(events: TrackingEventLogEntry[]): Map<string, SessionFlags> {
  const sessions = new Map<string, SessionFlags>();
  // events sortés ASC pour first_page cohérent.
  const sorted = [...events].sort(
    (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime(),
  );
  for (const e of sorted) {
    let s = sessions.get(e.sessionId);
    if (!s) {
      s = {
        view: false,
        engage: false,
        cta: false,
        checkout: false,
        purchase: false,
        firstPage: null,
        firstPageTs: Number.POSITIVE_INFINITY,
        stageFirstTs: {},
      };
      sessions.set(e.sessionId, s);
    }
    const t = e.receivedAt.getTime();
    if (t < s.firstPageTs && e.pageRoute) {
      s.firstPage = e.pageRoute;
      s.firstPageTs = t;
    }
    const stage = classifyStage(e);
    if (stage) {
      s[stage] = true;
      const prev = s.stageFirstTs[stage];
      if (prev === undefined || t < prev) s.stageFirstTs[stage] = t;
    }
  }
  return sessions;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid]!;
  return (s[mid - 1]! + s[mid]!) / 2;
}

/* ─────────────────────────────────────────────────────────────────────
 * Fetching (DB or memoryStore)
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
    // Requête paramétrée (F-SEC-01) : valeurs liées, pas interpolées.
    const conditions = [
      sql`received_at >= ${opts.from.toISOString()}`,
      sql`received_at < ${opts.to.toISOString()}`,
      sql`consent_snapshot->>'analytics_storage' = 'granted'`,
    ];
    if (opts.device) conditions.push(sql`device = ${opts.device}`);
    if (opts.traffic) conditions.push(sql`traffic_source = ${opts.traffic}`);
    const whereSql = sql.join(conditions, sql` AND `);
    const rows = await drizzle.execute(
      sql`SELECT id, event_id, event_name, event_category, page_id, component_id,
                page_route, anonymous_id, session_id, user_id, consent_snapshot,
                payload, ua_hash, ip_anonymized, device, locale, is_conversion,
                providers_dispatched, providers_results, received_at, schema_version,
                traffic_source, traffic_medium, experiment_id, experiment_variant
         FROM tracking_events_log
         WHERE ${whereSql}
         ORDER BY received_at ASC`,
    );
    return (rows as unknown as Record<string, unknown>[]).map(rowToEntry);
  }

  const store = memoryStore();
  let entries = Array.from(store.trackingEventsLog.values()).filter(
    (e) =>
      e.receivedAt >= opts.from &&
      e.receivedAt < opts.to &&
      e.consentSnapshot?.analytics_storage === 'granted',
  );
  if (opts.device) entries = entries.filter((e) => e.device === opts.device);
  if (opts.traffic) entries = entries.filter((e) => trafficOf(e) === opts.traffic);
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

function trafficOf(e: TrackingEventLogEntry): TrafficBucket {
  if (e.trafficSource) return e.trafficSource as TrafficBucket;
  const p = e.payload ?? {};
  const referrer = readStr(p, 'referrer') ?? null;
  return classifyTraffic({
    utm: {
      utm_source: readStr(p, 'utm_source', 'utmSource') ?? null,
      utm_medium: readStr(p, 'utm_medium', 'utmMedium') ?? null,
      utm_campaign: readStr(p, 'utm_campaign', 'utmCampaign') ?? null,
    },
    referrer,
  }).source;
}

function readStr(
  obj: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}
