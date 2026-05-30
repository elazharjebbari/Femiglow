/**
 * Queries pour l'onglet "Checkout".
 * cf. docs/analytics/05-onglets-specs.md §5 et docs/analytics/02-data-model.md §4.4
 *
 * 4 KPIs session-level + funnel 6 étapes (View Cart → Begin Checkout → Add
 * Shipping → Add Payment → Submit → Purchase) + histogramme time-to-submit
 * (begin_checkout → purchase, plafonné à 30 min, percentiles P25/P50/P75/P95)
 * + top erreurs formulaire et champs abandonnés.
 *
 * Les `purchase_server` (webhook fallback Stripe) comptent dans `purchase`,
 * mais sont identifiés à part dans le breakdown KPI pour la transparence ops.
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
import { getCachedAnalytics, setCachedAnalytics } from '../cache';

/** Étapes ordonnées du funnel checkout. */
export const CHECKOUT_STAGES = [
  'view_cart',
  'begin_checkout',
  'add_shipping',
  'add_payment',
  'submit',
  'purchase',
] as const;
export type CheckoutStage = (typeof CHECKOUT_STAGES)[number];

/** Plafond outliers sur le time-to-submit (cf. spec §5.6). */
export const MAX_TTS_SECONDS = 30 * 60;
/** Filtre bot heuristique (sub-second submit). */
export const MIN_TTS_SECONDS = 1;
/** Fenêtre d'abandon : begin_checkout sans purchase dans les 60 min. */
export const ABANDON_WINDOW_MS = 60 * 60_000;

export interface CheckoutKpiTotals {
  /** Sessions ayant émis au moins un `view_cart`. */
  viewCart: number;
  /** Sessions ayant émis au moins un `begin_checkout`. */
  beginCheckout: number;
  /** Sessions ayant émis au moins un `purchase` (client + serveur). */
  submissions: number;
  /** Sessions begin_checkout sans purchase dans la fenêtre 60 min. */
  abandons: number;
  /** Sous-total `purchase_server` (webhook fallback) dans `submissions`. */
  serverFallbackPurchases: number;
}

export interface CheckoutFunnelStep {
  stage: CheckoutStage;
  sessions: number;
  /** ratio step_n / step_(n-1). null pour la 1ère étape. */
  progressionFromPrevious: number | null;
  /** 1 - step_(n+1)/step_n. null pour la dernière étape. */
  dropoffToNext: number | null;
}

export interface CheckoutFormError {
  fieldId: string;
  errorCode: string;
  occurrences: number;
  affectedSessions: number;
}

export interface CheckoutAbandonedField {
  lastField: string;
  abandons: number;
}

export interface CheckoutTimeToSubmitBucket {
  /** Borne basse en secondes (incluse). */
  fromSeconds: number;
  /** Borne haute en secondes (exclue). */
  toSeconds: number;
  sessions: number;
}

export interface CheckoutTimeToSubmit {
  /** Histogramme par buckets de 50 s, 0..600. */
  buckets: CheckoutTimeToSubmitBucket[];
  /** Percentiles en secondes. null si données insuffisantes. */
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p95: number | null;
  /** Nombre total de sessions retenues (post-filtre bot/outliers). */
  sampleSize: number;
}

export interface CheckoutData {
  range: { from: string; to: string };
  totals: CheckoutKpiTotals;
  steps: CheckoutFunnelStep[];
  timeToSubmit: CheckoutTimeToSubmit;
  topErrors: CheckoutFormError[];
  topAbandonedFields: CheckoutAbandonedField[];
}

/* ─────────────────────────────────────────────────────────────────────
 * Public entrypoint
 * ───────────────────────────────────────────────────────────────────── */

export async function getCheckoutData(
  filters: AnalyticsFilters,
  now: Date = new Date(),
): Promise<CheckoutData> {
  const cacheKey = `checkout:${JSON.stringify(filters)}`;
  const cached = getCachedAnalytics<CheckoutData>(cacheKey, now.getTime());
  if (cached) return cached;
  const range = resolveRange(filters, now);
  const events = await fetchEvents({
    from: range.from,
    to: range.to,
    device: filters.device === 'all' ? undefined : filters.device,
    traffic: filters.traffic === 'all' ? undefined : filters.traffic,
  });

  // Aggregate session-level booleans across the funnel + first beginCheckout
  // ts (pour TTS et calcul abandons).
  const sessions = aggregateSessions(events);

  // F-CHK-03 : un achat peut survenir juste après la fin de période (la session
  // a démarré le checkout dans [from,to] mais convertit à to+Δ). On récupère les
  // purchases dans (to, to+60min] pour ne pas compter ces sessions comme abandons
  // à tort. Ces events ne comptent PAS dans les KPI/funnel de la période.
  const latePurchaseTs = new Map<string, number>();
  {
    const late = await fetchEvents({
      from: range.to,
      to: new Date(range.to.getTime() + ABANDON_WINDOW_MS),
      device: filters.device === 'all' ? undefined : filters.device,
      traffic: filters.traffic === 'all' ? undefined : filters.traffic,
    });
    for (const e of late) {
      if (e.eventName !== 'purchase' && e.eventName !== 'purchase_server') continue;
      const t = e.receivedAt.getTime();
      const prev = latePurchaseTs.get(e.sessionId);
      if (prev === undefined || t < prev) latePurchaseTs.set(e.sessionId, t);
    }
  }

  // KPI + funnel counts
  const stepCounts: Record<CheckoutStage, number> = {
    view_cart: 0,
    begin_checkout: 0,
    add_shipping: 0,
    add_payment: 0,
    submit: 0,
    purchase: 0,
  };
  let abandons = 0;
  let serverFallback = 0;

  for (const [sessionId, s] of sessions.entries()) {
    // Funnel cumulatif : pour passer au step N, il faut tous les steps < N
    // OU au moins le begin_checkout (les "skip" steps sont OK — un user peut
    // sauter add_shipping si pas applicable). Convention : on ne remonte pas
    // un step qui n'a pas eu lieu, mais on n'invalide pas les suivants.
    if (s.view_cart) stepCounts.view_cart += 1;
    if (s.begin_checkout) stepCounts.begin_checkout += 1;
    if (s.add_shipping) stepCounts.add_shipping += 1;
    if (s.add_payment) stepCounts.add_payment += 1;
    if (s.submit) stepCounts.submit += 1;
    if (s.purchase) stepCounts.purchase += 1;

    if (s.purchaseServer) serverFallback += 1;

    // Abandon : a démarré le checkout mais pas de purchase (fenêtre 60 min
    // écoulée) OU purchase au-delà de la fenêtre 60 min.
    if (s.begin_checkout && s.beginCheckoutTs !== null) {
      if (!s.purchase) {
        // Un begin_checkout récent (< 60 min) peut encore convertir : on ne le
        // compte pas comme abandon tant que la fenêtre n'est pas écoulée (F-CHK-04).
        // Ni s'il a converti juste après la fin de période (F-CHK-03).
        const lateTs = latePurchaseTs.get(sessionId);
        const convertedSoon =
          lateTs !== undefined && lateTs - s.beginCheckoutTs <= ABANDON_WINDOW_MS;
        if (now.getTime() - s.beginCheckoutTs > ABANDON_WINDOW_MS && !convertedSoon) {
          abandons += 1;
        }
      } else if (s.purchaseTs !== null && s.purchaseTs - s.beginCheckoutTs > ABANDON_WINDOW_MS) {
        abandons += 1;
      }
    }
  }

  // Modèle BOOL_OR : chaque étape compte les sessions ayant émis l'event,
  // indépendamment des autres (un visiteur peut entrer directement au
  // begin_checkout sans view_cart). `progressionFromPrevious` peut donc dépasser
  // 100 % (étape plus peuplée que la précédente) ; le `dropoffToNext` est clampé
  // à 0 car un « drop-off négatif » n'a pas de sens à afficher.
  // cf. docs/analytics-audit-qa-2026-05-30 — finding AF-03.
  const steps: CheckoutFunnelStep[] = CHECKOUT_STAGES.map((stage, idx) => {
    const cur = stepCounts[stage];
    const prev = idx > 0 ? stepCounts[CHECKOUT_STAGES[idx - 1]!] : null;
    const next = idx < CHECKOUT_STAGES.length - 1
      ? stepCounts[CHECKOUT_STAGES[idx + 1]!]
      : null;
    return {
      stage,
      sessions: cur,
      progressionFromPrevious:
        prev !== null && prev > 0 ? cur / prev : null,
      dropoffToNext:
        next !== null && cur > 0 ? Math.max(0, 1 - next / cur) : null,
    };
  });

  const totals: CheckoutKpiTotals = {
    viewCart: stepCounts.view_cart,
    beginCheckout: stepCounts.begin_checkout,
    submissions: stepCounts.purchase,
    abandons,
    serverFallbackPurchases: serverFallback,
  };

  // Time-to-submit : sessions ayant begin_checkout ET purchase ; durée filtrée
  // [MIN, MAX] pour exclure bots et outliers (cf. spec §5.6).
  const ttsValuesSec: number[] = [];
  for (const s of sessions.values()) {
    if (
      s.begin_checkout &&
      s.purchase &&
      s.beginCheckoutTs !== null &&
      s.purchaseTs !== null &&
      s.purchaseTs >= s.beginCheckoutTs
    ) {
      const seconds = (s.purchaseTs - s.beginCheckoutTs) / 1000;
      if (seconds < MIN_TTS_SECONDS) continue;
      const capped = Math.min(seconds, MAX_TTS_SECONDS);
      ttsValuesSec.push(capped);
    }
  }
  const timeToSubmit = buildTimeToSubmit(ttsValuesSec);

  // Top erreurs formulaire : group by (field_id, error_code).
  const errors = new Map<
    string,
    { fieldId: string; errorCode: string; occ: number; sessions: Set<string> }
  >();
  for (const e of events) {
    if (e.eventName !== 'form_validation_error') continue;
    const fieldId = readStr(e.payload, 'field_id', 'fieldId') ?? 'unknown';
    const errorCode = readStr(e.payload, 'error_code', 'errorCode') ?? 'unknown';
    const key = `${fieldId}|${errorCode}`;
    const acc = errors.get(key) ?? {
      fieldId,
      errorCode,
      occ: 0,
      sessions: new Set<string>(),
    };
    acc.occ += 1;
    acc.sessions.add(e.sessionId);
    errors.set(key, acc);
  }
  const topErrors: CheckoutFormError[] = Array.from(errors.values())
    .map((v) => ({
      fieldId: v.fieldId,
      errorCode: v.errorCode,
      occurrences: v.occ,
      affectedSessions: v.sessions.size,
    }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 20);

  // Top champs abandonnés : group by last_field_id sur form_abandon.
  const abandoned = new Map<string, number>();
  for (const e of events) {
    if (e.eventName !== 'form_abandon') continue;
    const lastField =
      readStr(e.payload, 'last_field_id', 'lastFieldId') ?? 'unknown';
    abandoned.set(lastField, (abandoned.get(lastField) ?? 0) + 1);
  }
  const topAbandonedFields: CheckoutAbandonedField[] = Array.from(abandoned.entries())
    .map(([lastField, count]) => ({ lastField, abandons: count }))
    .sort((a, b) => b.abandons - a.abandons)
    .slice(0, 10);

  const result: CheckoutData = {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    totals,
    steps,
    timeToSubmit,
    topErrors,
    topAbandonedFields,
  };
  setCachedAnalytics(cacheKey, result, now.getTime());
  return result;
}

/* ─────────────────────────────────────────────────────────────────────
 * Session aggregation
 * ───────────────────────────────────────────────────────────────────── */

interface SessionFlags {
  view_cart: boolean;
  begin_checkout: boolean;
  add_shipping: boolean;
  add_payment: boolean;
  submit: boolean;
  purchase: boolean;
  /** True si le purchase est venu via webhook serveur (fallback). */
  purchaseServer: boolean;
  /** Premier timestamp begin_checkout (ms). */
  beginCheckoutTs: number | null;
  /** Premier timestamp purchase (ms), client OU serveur. */
  purchaseTs: number | null;
}

function emptyFlags(): SessionFlags {
  return {
    view_cart: false,
    begin_checkout: false,
    add_shipping: false,
    add_payment: false,
    submit: false,
    purchase: false,
    purchaseServer: false,
    beginCheckoutTs: null,
    purchaseTs: null,
  };
}

function classifyEvent(e: TrackingEventLogEntry): CheckoutStage | null {
  switch (e.eventName) {
    case 'view_cart':
      return 'view_cart';
    case 'begin_checkout':
      return 'begin_checkout';
    case 'add_shipping_info':
    case 'add_shipping':
      return 'add_shipping';
    case 'add_payment_info':
    case 'add_payment':
      return 'add_payment';
    // `submit` = la soumission du formulaire (avant confirm Stripe).
    case 'checkout_submit':
    case 'submit':
      return 'submit';
    case 'purchase':
    case 'purchase_server':
      return 'purchase';
    default:
      return null;
  }
}

function aggregateSessions(
  events: TrackingEventLogEntry[],
): Map<string, SessionFlags> {
  const sessions = new Map<string, SessionFlags>();
  const sorted = [...events].sort(
    (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime(),
  );
  for (const e of sorted) {
    let s = sessions.get(e.sessionId);
    if (!s) {
      s = emptyFlags();
      sessions.set(e.sessionId, s);
    }
    const stage = classifyEvent(e);
    if (!stage) continue;
    const t = e.receivedAt.getTime();
    s[stage] = true;
    if (stage === 'begin_checkout' && (s.beginCheckoutTs === null || t < s.beginCheckoutTs)) {
      s.beginCheckoutTs = t;
    }
    if (stage === 'purchase' && (s.purchaseTs === null || t < s.purchaseTs)) {
      s.purchaseTs = t;
    }
    if (e.eventName === 'purchase_server') {
      s.purchaseServer = true;
    }
    // Note : `submit` est implicite quand `purchase` arrive sans submit explicite
    // (les forms n'émettent pas tous un `checkout_submit` distinct). On considère
    // alors qu'il y a eu submission. Cf. spec §5.6 (skip step != drop).
    if (stage === 'purchase') {
      s.submit = true;
    }
  }
  return sessions;
}

/* ─────────────────────────────────────────────────────────────────────
 * Time-to-submit histogram
 * ───────────────────────────────────────────────────────────────────── */

function buildTimeToSubmit(values: number[]): CheckoutTimeToSubmit {
  const buckets: CheckoutTimeToSubmitBucket[] = [];
  // 12 buckets de 50 s, 0..600 (cf. spec §5.4-B).
  const BUCKET_WIDTH = 50;
  const BUCKET_COUNT = 12;
  for (let i = 0; i < BUCKET_COUNT; i += 1) {
    buckets.push({
      fromSeconds: i * BUCKET_WIDTH,
      toSeconds: (i + 1) * BUCKET_WIDTH,
      sessions: 0,
    });
  }
  for (const v of values) {
    const idx = Math.min(Math.floor(v / BUCKET_WIDTH), BUCKET_COUNT - 1);
    buckets[idx]!.sessions += 1;
  }

  return {
    buckets,
    p25: percentile(values, 0.25),
    p50: percentile(values, 0.5),
    p75: percentile(values, 0.75),
    p95: percentile(values, 0.95),
    sampleSize: values.length,
  };
}

function percentile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower] ?? null;
  const fraction = pos - lower;
  return (sorted[lower] ?? 0) + ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)) * fraction;
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
