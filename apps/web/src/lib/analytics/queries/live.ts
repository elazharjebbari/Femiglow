/**
 * Queries pour l'onglet "Live" (temps réel).
 * cf. docs/analytics/05-onglets-specs.md §2
 *
 * Stratégie : un seul `readLiveSnapshot()` regroupe TOUS les KPI live, qu'ils
 * soient diffusés via SSE ou récupérés en polling. Le snapshot est mis en
 * cache mémoire 1 seconde — N admins en parallèle ne déclenchent qu'1 lecture
 * DB. Implémentation pragmatique : on consomme le memoryStore quand
 * Postgres n'est pas configuré (tests / dev), sinon on tape `tracking_events_log`
 * directement (pas de matview, fenêtres < 1 h).
 *
 * Window : `1h` | `2h` | `3h` (sélecteur côté admin).
 */
import { sql } from 'drizzle-orm';

import { db, memoryStore } from '@/lib/db/client';
import type {
  TrackingEventCategory,
  TrackingEventLogEntry,
} from '@/lib/db/types';
import { classifyTraffic, type TrafficBucket } from '../attribution';

export const LIVE_WINDOWS = ['1h', '2h', '3h'] as const;
export type LiveWindow = (typeof LIVE_WINDOWS)[number];

const ONLINE_WINDOW_MS = 5 * 60_000; // 5 min — sessions « en ligne »

export interface LiveKpiBig {
  online: number;
  conversions: number;
  ctaPurchase: number;
  windowMinutes: number;
}

export interface LivePageRow {
  pageRoute: string;
  users: number;
}

export interface LiveSourceRow {
  source: TrafficBucket;
  sessions: number;
}

export interface LiveDeviceRow {
  device: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  sessions: number;
}

export interface LiveStreamEvent {
  eventId: string;
  eventName: string;
  eventCategory: TrackingEventCategory;
  pageRoute: string;
  device: TrackingEventLogEntry['device'];
  locale: string;
  receivedAt: string; // ISO
  payload: Record<string, unknown>;
}

export interface LiveFunnelStep {
  stage: 'tof' | 'mof' | 'bof' | 'conversion';
  sessions: number;
}

export interface LiveSnapshot {
  /** ISO timestamp de production du snapshot — base pour le freshness banner. */
  generatedAt: string;
  window: LiveWindow;
  kpiBig: LiveKpiBig;
  byPage: LivePageRow[];
  bySource: LiveSourceRow[];
  byDevice: LiveDeviceRow[];
  recentEvents: LiveStreamEvent[];
  funnel: LiveFunnelStep[];
}

/* ─────────────────────────────────────────────────────────────────────
 * Cache mémoire (1 s) — partage entre N admins simultanés
 * ───────────────────────────────────────────────────────────────────── */

interface CacheEntry {
  snapshot: LiveSnapshot;
  expiresAt: number;
}
const SNAPSHOT_CACHE_MS = 1_000;
const cache = new Map<LiveWindow, CacheEntry>();

/** Pour les tests : flush du cache mémoire. */
export function clearLiveSnapshotCache(): void {
  cache.clear();
}

/* ─────────────────────────────────────────────────────────────────────
 * Public entrypoint
 * ───────────────────────────────────────────────────────────────────── */

export interface ReadLiveOptions {
  window?: LiveWindow;
  /** Override `now` pour tests. */
  now?: Date;
  /** Désactive le cache (utile pour tests SSE qui mutent le store). */
  bypassCache?: boolean;
}

export async function readLiveSnapshot(
  opts: ReadLiveOptions = {},
): Promise<LiveSnapshot> {
  const window = opts.window ?? '1h';
  const now = opts.now ?? new Date();

  if (!opts.bypassCache) {
    const hit = cache.get(window);
    if (hit && hit.expiresAt > now.getTime()) return hit.snapshot;
  }

  const windowMs = windowToMs(window);
  const events = await fetchEventsSince(new Date(now.getTime() - windowMs));

  const snapshot: LiveSnapshot = {
    generatedAt: now.toISOString(),
    window,
    kpiBig: computeKpiBig(events, now, windowMs),
    byPage: computeByPage(events, now),
    bySource: computeBySource(events, now, windowMs),
    byDevice: computeByDevice(events, now, windowMs),
    recentEvents: computeRecentEvents(events, 100),
    funnel: computeFunnel(events, now, windowMs),
  };

  cache.set(window, {
    snapshot,
    expiresAt: now.getTime() + SNAPSHOT_CACHE_MS,
  });
  return snapshot;
}

function windowToMs(w: LiveWindow): number {
  switch (w) {
    case '1h':
      return 60 * 60_000;
    case '2h':
      return 2 * 60 * 60_000;
    case '3h':
      return 3 * 60 * 60_000;
  }
}

/* ─────────────────────────────────────────────────────────────────────
 * Fetching
 * ───────────────────────────────────────────────────────────────────── */

async function fetchEventsSince(since: Date): Promise<TrackingEventLogEntry[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.execute(
      sql.raw(
        `SELECT id, event_id, event_name, event_category, page_id, component_id,
                page_route, anonymous_id, session_id, user_id, consent_snapshot,
                payload, ua_hash, ip_anonymized, device, locale, is_conversion,
                providers_dispatched, providers_results, received_at, schema_version,
                traffic_source, traffic_medium, experiment_id, experiment_variant
         FROM tracking_events_log
         WHERE received_at >= '${since.toISOString()}'
           AND consent_snapshot->>'analytics_storage' = 'granted'
         ORDER BY received_at DESC`,
      ),
    );
    return (rows as unknown as Record<string, unknown>[]).map(rowToEntry);
  }
  // memoryStore
  const store = memoryStore();
  return Array.from(store.trackingEventsLog.values())
    .filter(
      (e) =>
        e.receivedAt >= since &&
        e.consentSnapshot?.analytics_storage === 'granted',
    )
    .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
}

function rowToEntry(row: Record<string, unknown>): TrackingEventLogEntry {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    eventName: String(row.event_name),
    eventCategory: row.event_category as TrackingEventCategory,
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

function computeKpiBig(
  events: TrackingEventLogEntry[],
  now: Date,
  windowMs: number,
): LiveKpiBig {
  const onlineCutoff = now.getTime() - ONLINE_WINDOW_MS;
  const windowCutoff = now.getTime() - windowMs;

  const online = new Set<string>();
  let conversions = 0;
  let ctaPurchase = 0;

  for (const e of events) {
    const t = e.receivedAt.getTime();
    if (t >= onlineCutoff) online.add(e.sessionId);
    if (t >= windowCutoff) {
      if (e.eventName === 'purchase') conversions += 1;
      if (
        e.eventName === 'cta_click' &&
        readStr(e.payload, 'cta_intent') === 'purchase'
      ) {
        ctaPurchase += 1;
      }
    }
  }

  return {
    online: online.size,
    conversions,
    ctaPurchase,
    windowMinutes: Math.round(windowMs / 60_000),
  };
}

function computeByPage(
  events: TrackingEventLogEntry[],
  now: Date,
  limit = 10,
): LivePageRow[] {
  const cutoff = now.getTime() - ONLINE_WINDOW_MS;
  const byPage = new Map<string, Set<string>>();
  for (const e of events) {
    if (e.receivedAt.getTime() < cutoff) continue;
    if (e.eventName !== 'page_view') continue;
    const set = byPage.get(e.pageRoute) ?? new Set<string>();
    set.add(e.sessionId);
    byPage.set(e.pageRoute, set);
  }
  return Array.from(byPage.entries())
    .map(([pageRoute, sessions]) => ({ pageRoute, users: sessions.size }))
    .sort((a, b) => b.users - a.users)
    .slice(0, limit);
}

function computeBySource(
  events: TrackingEventLogEntry[],
  now: Date,
  windowMs: number,
): LiveSourceRow[] {
  const cutoff = now.getTime() - windowMs;
  const bySource = new Map<TrafficBucket, Set<string>>();
  for (const e of events) {
    if (e.receivedAt.getTime() < cutoff) continue;
    const bucket = trafficOf(e);
    const set = bySource.get(bucket) ?? new Set<string>();
    set.add(e.sessionId);
    bySource.set(bucket, set);
  }
  return Array.from(bySource.entries())
    .map(([source, sessions]) => ({ source, sessions: sessions.size }))
    .sort((a, b) => b.sessions - a.sessions);
}

function computeByDevice(
  events: TrackingEventLogEntry[],
  now: Date,
  windowMs: number,
): LiveDeviceRow[] {
  const cutoff = now.getTime() - windowMs;
  const byDevice = new Map<LiveDeviceRow['device'], Set<string>>();
  for (const e of events) {
    if (e.receivedAt.getTime() < cutoff) continue;
    const device = (e.device ?? 'unknown') as LiveDeviceRow['device'];
    const set = byDevice.get(device) ?? new Set<string>();
    set.add(e.sessionId);
    byDevice.set(device, set);
  }
  return Array.from(byDevice.entries())
    .map(([device, sessions]) => ({ device, sessions: sessions.size }))
    .sort((a, b) => b.sessions - a.sessions);
}

function computeRecentEvents(
  events: TrackingEventLogEntry[],
  limit: number,
): LiveStreamEvent[] {
  // events already sorted DESC par receivedAt
  return events.slice(0, limit).map((e) => ({
    eventId: e.eventId,
    eventName: e.eventName,
    eventCategory: e.eventCategory,
    pageRoute: e.pageRoute,
    device: e.device,
    locale: e.locale,
    receivedAt: e.receivedAt.toISOString(),
    payload: e.payload ?? {},
  }));
}

/**
 * Mapping event_name → funnel_stage. Source de vérité = la migration 0009 +
 * event-catalog. Ici on duplique en TS pour éviter une lookup DB par snapshot
 * (perf live). Si un event n'est pas mappé → on l'ignore (les events `admin`
 * et `custom` n'entrent pas dans le funnel).
 */
const FUNNEL_STAGE_BY_EVENT: Record<string, LiveFunnelStep['stage']> = {
  page_view: 'tof',
  view_item: 'tof',
  view_item_list: 'tof',
  scroll_depth_25: 'tof',
  scroll_depth_50: 'mof',
  scroll_depth_75: 'mof',
  video_user_play: 'mof',
  video_complete: 'mof',
  cta_impression: 'mof',
  cta_click: 'mof',
  add_to_cart: 'bof',
  remove_from_cart: 'bof',
  view_cart: 'bof',
  begin_checkout: 'bof',
  add_shipping_info: 'bof',
  add_payment_info: 'bof',
  generate_lead: 'bof',
  contact_submit: 'bof',
  purchase: 'conversion',
};

function computeFunnel(
  events: TrackingEventLogEntry[],
  now: Date,
  windowMs: number,
): LiveFunnelStep[] {
  const cutoff = now.getTime() - windowMs;
  const sessionsByStage: Record<LiveFunnelStep['stage'], Set<string>> = {
    tof: new Set(),
    mof: new Set(),
    bof: new Set(),
    conversion: new Set(),
  };
  for (const e of events) {
    if (e.receivedAt.getTime() < cutoff) continue;
    const stage = FUNNEL_STAGE_BY_EVENT[e.eventName];
    if (!stage) continue;
    sessionsByStage[stage].add(e.sessionId);
  }
  return [
    { stage: 'tof', sessions: sessionsByStage.tof.size },
    { stage: 'mof', sessions: sessionsByStage.mof.size },
    { stage: 'bof', sessions: sessionsByStage.bof.size },
    { stage: 'conversion', sessions: sessionsByStage.conversion.size },
  ];
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
