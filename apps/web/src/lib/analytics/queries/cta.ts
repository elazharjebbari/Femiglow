/**
 * Queries pour l'onglet "CTA".
 * cf. docs/analytics/05-onglets-specs.md §4 et docs/analytics/02-data-model.md §4.3
 *
 * Modèle d'attribution :
 *  - Pour chaque `purchase`, on cherche le **dernier** `cta_click` antérieur
 *    dans la session de l'achat. Si aucun CTA dans la session d'achat, on
 *    élargit aux 7 jours précédents pour le même `anonymous_id`.
 *  - Last-click strict : un seul CTA par achat reçoit le crédit (clicks +
 *    revenu). Plusieurs achats sur un même CTA cumulent.
 *
 * Sortie : KPI globaux (impressions/clicks/conv/revenue) + DataTable principale
 * par component_id (label/role/page) + top messages (group by label) + top
 * pages (group by page_route, lecture orthogonale).
 *
 * Implémentation pragmatique : memoryStore en dev/test, scan
 * `tracking_events_log` filtré par consent + période + device + traffic. La
 * matview `mv_cta_performance` est privilégiée plus tard pour la perf prod
 * (fenêtres > 30 j) — V1 ne l'utilise pas encore pour rester simple.
 */
import { sql } from 'drizzle-orm';

import { db, memoryStore } from '@/lib/db/client';
import type {
  TrackingComponent,
  TrackingEventLogEntry,
} from '@/lib/db/types';

import { classifyTraffic, type TrafficBucket } from '../attribution';
import type { AnalyticsFilters } from '../filters';
import { resolveRange } from '../filters';

/** Fenêtre d'attribution en ms — 7 jours. */
const ATTRIBUTION_WINDOW_MS = 7 * 24 * 60 * 60_000;

export interface CtaKpiTotals {
  impressions: number;
  clicks: number;
  /** clicks → purchase ratio (last-click attribution). */
  conversionRate: number | null;
  /** Somme du `value` des purchases attribuables, en cents. */
  revenueAttributedCents: number;
}

export interface CtaRow {
  componentId: string;
  /** Label affiché (defaultParams.label || component.name). */
  label: string;
  /** Catégorie tracking ; pour l'admin = synonyme de "role". */
  role: string;
  /** Page d'origine majoritaire (la plus cliquée). */
  pageRoute: string | null;
  impressions: number;
  clicks: number;
  purchasesAttributed: number;
  /** Cents. */
  revenueAttributedCents: number;
  /** clicks/impressions. null si impressions=0. */
  clickRate: number | null;
  /** purchases/clicks. null si clicks=0. */
  conversionRate: number | null;
  /** True quand le component est soft-deleted (deletedAt IS NOT NULL). */
  isDeleted: boolean;
}

export interface CtaTopMessage {
  label: string;
  purchasesAttributed: number;
  clicks: number;
  conversionRate: number | null;
}

export interface CtaTopPage {
  pageRoute: string;
  impressions: number;
  clicks: number;
  purchasesAttributed: number;
  conversionRate: number | null;
}

export interface CtaData {
  range: { from: string; to: string };
  totals: CtaKpiTotals;
  rows: CtaRow[];
  topMessages: CtaTopMessage[];
  topPages: CtaTopPage[];
}

/* ─────────────────────────────────────────────────────────────────────
 * Public entrypoint
 * ───────────────────────────────────────────────────────────────────── */

export async function getCtaData(
  filters: AnalyticsFilters,
  now: Date = new Date(),
): Promise<CtaData> {
  const range = resolveRange(filters, now);

  // On élargit la fenêtre de fetch à `from - 7j` pour pouvoir attribuer un
  // achat qui aurait reçu un CTA cliqué juste avant la période.
  const fetchFrom = new Date(range.from.getTime() - ATTRIBUTION_WINDOW_MS);
  const events = await fetchEvents({
    from: fetchFrom,
    to: range.to,
    device: filters.device === 'all' ? undefined : filters.device,
    traffic: filters.traffic === 'all' ? undefined : filters.traffic,
  });
  const components = await fetchComponents();

  // Attribution : pour chaque purchase dans [from, to], trouve le dernier
  // cta_click dans (purchase.session) ∪ (anon, ≤ 7j avant).
  const attributions = attributePurchases(events, range.from, range.to);

  // Compute aggregates par component_id
  const byComp = new Map<string, ComponentAgg>();
  // ... events de la fenêtre principale [from, to]
  for (const e of events) {
    const t = e.receivedAt.getTime();
    if (t < range.from.getTime() || t >= range.to.getTime()) continue;
    if (!e.componentId) continue;
    const acc = ensureAgg(byComp, e.componentId);
    if (e.eventName === 'cta_impression') acc.impressions += 1;
    if (e.eventName === 'cta_click') {
      acc.clicks += 1;
      const route = e.pageRoute;
      acc.pageRouteCounts.set(route, (acc.pageRouteCounts.get(route) ?? 0) + 1);
    }
  }
  // Ajoute attributions
  for (const att of attributions) {
    const acc = ensureAgg(byComp, att.componentId);
    acc.purchasesAttributed += 1;
    acc.revenueAttributedCents += att.valueCents;
  }

  // Build rows
  const rows: CtaRow[] = Array.from(byComp.entries())
    .filter(([, v]) => v.impressions > 0 || v.clicks > 0 || v.purchasesAttributed > 0)
    .map(([componentId, v]) => {
      const comp = components.get(componentId);
      const label = (comp?.defaultParams?.label as string | undefined) ?? comp?.name ?? componentId;
      const role = comp?.category ?? 'unknown';
      const topPage = topByCount(v.pageRouteCounts);
      return {
        componentId,
        label,
        role,
        pageRoute: topPage,
        impressions: v.impressions,
        clicks: v.clicks,
        purchasesAttributed: v.purchasesAttributed,
        revenueAttributedCents: v.revenueAttributedCents,
        clickRate: v.impressions > 0 ? v.clicks / v.impressions : null,
        conversionRate: v.clicks > 0 ? v.purchasesAttributed / v.clicks : null,
        isDeleted: comp?.deletedAt != null,
      };
    })
    // Note : clicks=0 + purchases>0 EST légitime avec un fallback 7j (le clic
    // initial peut être hors période d'affichage). Pas de filtre ici, contrairement
    // au comportement « impossible logiquement » de la spec qui supposait une
    // attribution intra-période.
    .sort((a, b) => b.purchasesAttributed - a.purchasesAttributed);

  // Aggregate top messages (group by label) — un même label peut couvrir
  // plusieurs components (variants visuels du même copy).
  const byLabel = new Map<string, { purchases: number; clicks: number }>();
  for (const r of rows) {
    const acc = byLabel.get(r.label) ?? { purchases: 0, clicks: 0 };
    acc.purchases += r.purchasesAttributed;
    acc.clicks += r.clicks;
    byLabel.set(r.label, acc);
  }
  const topMessages: CtaTopMessage[] = Array.from(byLabel.entries())
    .map(([label, v]) => ({
      label,
      purchasesAttributed: v.purchases,
      clicks: v.clicks,
      conversionRate: v.clicks > 0 ? v.purchases / v.clicks : null,
    }))
    .filter((m) => m.purchasesAttributed > 0 || m.clicks > 0)
    .sort((a, b) => b.purchasesAttributed - a.purchasesAttributed)
    .slice(0, 10);

  // Top pages : on agrège par page_route depuis les events directement
  // (page d'origine du clic, pas celle du purchase).
  const byPage = new Map<string, { impressions: number; clicks: number; purchases: number }>();
  for (const e of events) {
    const t = e.receivedAt.getTime();
    if (t < range.from.getTime() || t >= range.to.getTime()) continue;
    if (e.eventName !== 'cta_impression' && e.eventName !== 'cta_click') continue;
    const route = e.pageRoute;
    const acc = byPage.get(route) ?? { impressions: 0, clicks: 0, purchases: 0 };
    if (e.eventName === 'cta_impression') acc.impressions += 1;
    if (e.eventName === 'cta_click') acc.clicks += 1;
    byPage.set(route, acc);
  }
  for (const att of attributions) {
    // L'achat peut être attribué à un clic survenu hors de [from,to] (fallback
    // 7 j) : on crée alors l'entrée de page pour réconcilier topPages avec les
    // totals. cf. docs/analytics-audit-qa-2026-05-30 — finding F-CTA-02.
    const acc = byPage.get(att.clickPageRoute) ?? { impressions: 0, clicks: 0, purchases: 0 };
    acc.purchases += 1;
    byPage.set(att.clickPageRoute, acc);
  }
  const topPages: CtaTopPage[] = Array.from(byPage.entries())
    .map(([pageRoute, v]) => ({
      pageRoute,
      impressions: v.impressions,
      clicks: v.clicks,
      purchasesAttributed: v.purchases,
      conversionRate: v.clicks > 0 ? v.purchases / v.clicks : null,
    }))
    .filter((p) => p.clicks > 0 || p.impressions > 0 || p.purchasesAttributed > 0)
    .sort((a, b) => b.purchasesAttributed - a.purchasesAttributed || b.clicks - a.clicks)
    .slice(0, 10);

  // Totals (KPI globaux)
  const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalPurchases = rows.reduce((s, r) => s + r.purchasesAttributed, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.revenueAttributedCents, 0);

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    totals: {
      impressions: totalImpressions,
      clicks: totalClicks,
      conversionRate: totalClicks > 0 ? totalPurchases / totalClicks : null,
      revenueAttributedCents: totalRevenue,
    },
    rows,
    topMessages,
    topPages,
  };
}

/* ─────────────────────────────────────────────────────────────────────
 * Attribution
 * ───────────────────────────────────────────────────────────────────── */

interface Attribution {
  componentId: string;
  clickPageRoute: string;
  valueCents: number;
  purchaseEventId: string;
}

/**
 * Pour chaque purchase dans [from, to], trouve le CTA last-click :
 *  1. CTA cliqué dans la session du purchase, < timestamp purchase → priorité.
 *  2. Sinon CTA cliqué (même anonymous_id) dans les 7j précédents → fallback.
 *
 * `events` doit couvrir au moins [from - 7j, to] pour que le fallback soit
 * fiable. La sortie associe 1 attribution par purchase (ou 0 si aucun CTA
 * matché).
 */
function attributePurchases(
  events: TrackingEventLogEntry[],
  from: Date,
  to: Date,
): Attribution[] {
  const sortedAsc = [...events].sort(
    (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime(),
  );

  // Pré-index : tous les cta_click par session_id et par anonymous_id.
  const clicksBySession = new Map<string, TrackingEventLogEntry[]>();
  const clicksByAnon = new Map<string, TrackingEventLogEntry[]>();
  for (const e of sortedAsc) {
    if (e.eventName !== 'cta_click') continue;
    if (!e.componentId) continue;
    pushTo(clicksBySession, e.sessionId, e);
    pushTo(clicksByAnon, e.anonymousId, e);
  }

  const out: Attribution[] = [];
  const fromMs = from.getTime();
  const toMs = to.getTime();

  for (const p of sortedAsc) {
    if (p.eventName !== 'purchase') continue;
    const ts = p.receivedAt.getTime();
    if (ts < fromMs || ts >= toMs) continue;

    // 1) Dernier CTA dans la même session ET avant le purchase.
    const sessionClicks = clicksBySession.get(p.sessionId) ?? [];
    const inSession = lastBefore(sessionClicks, ts);
    let attributed = inSession;

    // 2) Fallback : 7j même anonymous_id.
    if (!attributed) {
      const anonClicks = clicksByAnon.get(p.anonymousId) ?? [];
      attributed = lastBefore(
        anonClicks,
        ts,
        ts - ATTRIBUTION_WINDOW_MS,
      );
    }
    if (!attributed || !attributed.componentId) continue;

    out.push({
      componentId: attributed.componentId,
      clickPageRoute: attributed.pageRoute,
      valueCents: readValueCents(p.payload),
      purchaseEventId: p.eventId,
    });
  }

  return out;
}

/** Cherche le dernier event `< before` (et `>= minTs` si fourni). Liste asc. */
function lastBefore(
  list: TrackingEventLogEntry[],
  before: number,
  minTs = -Infinity,
): TrackingEventLogEntry | null {
  let result: TrackingEventLogEntry | null = null;
  for (const e of list) {
    const t = e.receivedAt.getTime();
    if (t >= before) break;
    if (t < minTs) continue;
    result = e;
  }
  return result;
}

function pushTo<K, V>(m: Map<K, V[]>, key: K, value: V): void {
  const list = m.get(key);
  if (list) list.push(value);
  else m.set(key, [value]);
}

/* ─────────────────────────────────────────────────────────────────────
 * Aggregates
 * ───────────────────────────────────────────────────────────────────── */

interface ComponentAgg {
  impressions: number;
  clicks: number;
  purchasesAttributed: number;
  revenueAttributedCents: number;
  pageRouteCounts: Map<string, number>;
}

function ensureAgg(map: Map<string, ComponentAgg>, key: string): ComponentAgg {
  let acc = map.get(key);
  if (!acc) {
    acc = {
      impressions: 0,
      clicks: 0,
      purchasesAttributed: 0,
      revenueAttributedCents: 0,
      pageRouteCounts: new Map(),
    };
    map.set(key, acc);
  }
  return acc;
}

function topByCount(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = -1;
  for (const [k, v] of counts) {
    // Tie-break déterministe : à égalité de comptage, on retient la clé la plus
    // petite (lexicographique) — résultat stable quel que soit l'ordre de la Map.
    // cf. docs/analytics-audit-qa-2026-05-30 — finding F-CTA-04.
    if (v > bestCount || (v === bestCount && best !== null && k < best)) {
      best = k;
      bestCount = v;
    }
  }
  return best;
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
    const conditions: string[] = [];
    conditions.push(`received_at >= '${opts.from.toISOString()}'`);
    conditions.push(`received_at < '${opts.to.toISOString()}'`);
    conditions.push(`consent_snapshot->>'analytics_storage' = 'granted'`);
    if (opts.device) conditions.push(`device = '${escape(opts.device)}'`);
    if (opts.traffic) conditions.push(`traffic_source = '${escape(opts.traffic)}'`);
    const where = conditions.join(' AND ');
    const rows = await drizzle.execute(
      sql.raw(
        `SELECT id, event_id, event_name, event_category, page_id, component_id,
                page_route, anonymous_id, session_id, user_id, consent_snapshot,
                payload, ua_hash, ip_anonymized, device, locale, is_conversion,
                providers_dispatched, providers_results, received_at, schema_version,
                traffic_source, traffic_medium, experiment_id, experiment_variant
         FROM tracking_events_log
         WHERE ${where}
         ORDER BY received_at ASC`,
      ),
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

async function fetchComponents(): Promise<Map<string, TrackingComponent>> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.execute(
      sql.raw(
        `SELECT id, name, path, category, description, enabled, default_params,
                created_at, updated_at, deleted_at
         FROM tracking_components`,
      ),
    );
    const out = new Map<string, TrackingComponent>();
    for (const row of rows as unknown as Record<string, unknown>[]) {
      const c: TrackingComponent = {
        id: String(row.id),
        name: String(row.name),
        path: String(row.path),
        category: row.category as TrackingComponent['category'],
        description: (row.description as string | null) ?? null,
        enabled: Boolean(row.enabled),
        defaultParams: (row.default_params as Record<string, unknown>) ?? {},
        createdAt: new Date(row.created_at as string | number | Date),
        updatedAt: new Date(row.updated_at as string | number | Date),
        deletedAt: row.deleted_at ? new Date(row.deleted_at as string | number | Date) : null,
      };
      out.set(c.id, c);
    }
    return out;
  }
  const store = memoryStore();
  return new Map(store.trackingComponents);
}

function escape(s: string): string {
  return s.replace(/'/g, "''");
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

function readNumber(
  obj: Record<string, unknown>,
  ...keys: string[]
): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const parsed = Number(v);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

/**
 * Lit la valeur d'un achat et la normalise en **cents**.
 *
 * Les events checkout émettent `value`/`amount` en **unité majeure** (MAD) —
 * cf. `lib/tracking/checkout-events.ts` (Enhanced Ecommerce GA4 : `currency` +
 * `value`). On multiplie donc par 100. Les clés `amount_cents`/`value_cents`
 * (si jamais émises) sont déjà en cents et prises telles quelles.
 *
 * cf. docs/analytics-audit-qa-2026-05-30 — finding AF-02 (revenu attribué ÷100).
 */
function readValueCents(obj: Record<string, unknown>): number {
  const cents = readNumber(obj, 'amount_cents', 'value_cents');
  if (cents !== null) return Math.round(cents);
  const major = readNumber(obj, 'value', 'amount');
  if (major !== null) return Math.round(major * 100);
  return 0;
}
