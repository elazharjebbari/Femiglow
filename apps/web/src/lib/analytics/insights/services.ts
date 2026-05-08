/**
 * Services de lecture Analytics Insights — overview, events, pages, components, sections, funnel.
 * cf. docs/analytics-insights/03-backend.md §3
 *
 * Ces services lisent EXCLUSIVEMENT les tables `insights_*` (pré-agrégées
 * par le pipeline `refresh.ts`). Ils n'accèdent jamais directement à
 * `tracking_events_log`, sauf pour la heatmap qui nécessite la résolution
 * horaire (V1 acceptable).
 *
 * Tous les services sont dual-driver : Drizzle/Postgres si DATABASE_URL,
 * memoryStore sinon (tests).
 */
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import type {
  InsightsComponentDailyRow,
  InsightsEventDailyRow,
  InsightsFunnelDailyRow,
  InsightsPageDailyRow,
  InsightsSectionDailyRow,
} from '@/lib/db/types';
import type {
  ComponentDetailResponse,
  ComponentRow,
  ComponentsResponse,
  DeadComponentsResponse,
  FunnelDropoff,
  FunnelResponse,
  FunnelStage,
  InsightsHeatmapCell,
  InsightsKpis,
  InsightsTimeseriesPoint,
  OverviewResponse,
  PageDetailResponse,
  PageRow,
  PagesResponse,
  SectionRow,
  SectionsResponse,
  TopEventRow,
  InsightsFilters,
} from './contracts';
import { listDays, resolveInsightsRange, toIsoDate } from './filters';

const CONVERSION_EVENTS = new Set([
  'purchase',
  'add_to_cart',
  'begin_checkout',
  'add_payment_info',
  'generate_lead',
]);

/* ═════════════════════════════════════════════════════════════════
 * OVERVIEW
 * ═════════════════════════════════════════════════════════════════ */

export async function getOverview(
  filters: InsightsFilters,
  now: Date = new Date(),
): Promise<OverviewResponse> {
  const range = resolveInsightsRange(filters, now);
  const fromDate = toIsoDate(range.from);
  const toDate = toIsoDate(range.to);
  const compFromDate = toIsoDate(range.comparisonFrom);
  const compToDate = toIsoDate(range.comparisonTo);

  const events = await fetchEventDaily(fromDate, toDate, filters);
  const pages = await fetchPageDaily(fromDate, toDate);
  const compEvents = await fetchEventDaily(compFromDate, compToDate, filters);
  const compPages = await fetchPageDaily(compFromDate, compToDate);

  const kpis = computeKpis(events, pages);
  const compKpis = computeKpis(compEvents, compPages);
  const variations = computeVariations(kpis, compKpis);
  const days = listDays(range.from, range.to);
  const timeseries = buildTimeseries(events, days);
  const heatmap = await buildHeatmap(range.from, range.to);
  const topEvents = buildTopEvents(events, 10);
  const refreshedAt = pickLatestRefresh(events, pages);

  return {
    kpis,
    variations,
    timeseries,
    heatmap,
    topEvents,
    refreshedAt,
    firstRun: events.length === 0 && pages.length === 0,
  };
}

function computeKpis(
  events: InsightsEventDailyRow[],
  pages: InsightsPageDailyRow[],
): InsightsKpis {
  const totalEvents = sumBy(events, (e) => e.count);
  const uniqueSessions = sumBy(events, (e) => e.uniqueSessions);
  const pageViews = sumBy(pages, (p) => p.pageViews);
  const conversions = sumBy(events, (e) => e.conversionCount);
  const totalPageSessions = sumBy(pages, (p) => p.uniqueSessions);
  const totalBounce = sumBy(pages, (p) => p.bounceCount);

  return {
    totalEvents,
    uniqueSessions,
    pageViews,
    conversions,
    avgEventsPerSession: uniqueSessions > 0 ? totalEvents / uniqueSessions : 0,
    bounceRate: totalPageSessions > 0 ? totalBounce / totalPageSessions : 0,
  };
}

function computeVariations(
  current: InsightsKpis,
  previous: InsightsKpis,
): Partial<Record<keyof InsightsKpis, number>> {
  const out: Partial<Record<keyof InsightsKpis, number>> = {};
  for (const key of Object.keys(current) as (keyof InsightsKpis)[]) {
    const cur = current[key];
    const prev = previous[key];
    if (prev > 0) out[key] = (cur - prev) / prev;
  }
  return out;
}

function buildTimeseries(
  events: InsightsEventDailyRow[],
  days: string[],
): InsightsTimeseriesPoint[] {
  const byDay = new Map<string, { events: number; sessions: number; conv: number }>();
  for (const e of events) {
    const slot = byDay.get(e.date) ?? { events: 0, sessions: 0, conv: 0 };
    slot.events += e.count;
    slot.sessions += e.uniqueSessions;
    slot.conv += e.conversionCount;
    byDay.set(e.date, slot);
  }
  return days.map((d) => {
    const v = byDay.get(d) ?? { events: 0, sessions: 0, conv: 0 };
    return { date: d, events: v.events, sessions: v.sessions, conversions: v.conv };
  });
}

async function buildHeatmap(from: Date, to: Date): Promise<InsightsHeatmapCell[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle.execute(sql`
      SELECT
        EXTRACT(HOUR FROM received_at)::int AS hour,
        EXTRACT(DOW FROM received_at)::int AS dow,
        COUNT(*)::int AS count
      FROM tracking_events_log
      WHERE received_at >= ${from.toISOString()} AND received_at < ${to.toISOString()}
      GROUP BY 1, 2
    `);
    return (rows as unknown as { hour: number; dow: number; count: number }[]).map((r) => ({
      hour: Number(r.hour),
      dayOfWeek: jsDowToFr(Number(r.dow)),
      count: Number(r.count),
    }));
  }
  // memoryStore : itérer sur les events log (acceptable pour les tests)
  const counts = new Map<string, number>();
  for (const e of memoryStore().trackingEventsLog.values()) {
    if (e.receivedAt < from || e.receivedAt >= to) continue;
    const hour = e.receivedAt.getUTCHours();
    const dow = jsDowToFr(e.receivedAt.getUTCDay());
    const key = `${hour}-${dow}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([key, count]) => {
    const parts = key.split('-').map(Number);
    return { hour: parts[0] ?? 0, dayOfWeek: parts[1] ?? 0, count };
  });
}

/** Convertit le DOW JS (0=Dim..6=Sam) → ISO (0=Lun..6=Dim) */
function jsDowToFr(dow: number): number {
  return (dow + 6) % 7;
}

function buildTopEvents(events: InsightsEventDailyRow[], limit: number): TopEventRow[] {
  const totals = new Map<string, { count: number; conv: number; cat: string }>();
  let totalCount = 0;
  for (const e of events) {
    totalCount += e.count;
    const slot = totals.get(e.eventName) ?? { count: 0, conv: 0, cat: e.eventCategory };
    slot.count += e.count;
    slot.conv += e.conversionCount;
    totals.set(e.eventName, slot);
  }
  return Array.from(totals.entries())
    .map(([eventName, v]) => ({
      eventName,
      eventCategory: v.cat,
      count: v.count,
      share: totalCount > 0 ? v.count / totalCount : 0,
      conversionCount: v.conv,
      isConversion: CONVERSION_EVENTS.has(eventName),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function pickLatestRefresh(
  events: InsightsEventDailyRow[],
  pages: InsightsPageDailyRow[],
): string | null {
  let latest: Date | null = null;
  for (const e of events) if (!latest || e.refreshedAt > latest) latest = e.refreshedAt;
  for (const p of pages) if (!latest || p.refreshedAt > latest) latest = p.refreshedAt;
  return latest ? latest.toISOString() : null;
}

/* ═════════════════════════════════════════════════════════════════
 * PAGES
 * ═════════════════════════════════════════════════════════════════ */

export async function getPagesTop(
  filters: InsightsFilters,
  limit = 30,
  now: Date = new Date(),
): Promise<PagesResponse> {
  const range = resolveInsightsRange(filters, now);
  const rows = await fetchPageDaily(toIsoDate(range.from), toIsoDate(range.to));
  const grouped = groupPages(rows);
  grouped.sort((a, b) => b.pageViews - a.pageViews);
  return {
    pages: grouped.slice(0, limit),
    totalRows: grouped.length,
  };
}

export async function getPageDetail(
  pageRoute: string,
  filters: InsightsFilters,
  now: Date = new Date(),
): Promise<PageDetailResponse> {
  const range = resolveInsightsRange(filters, now);
  const fromDate = toIsoDate(range.from);
  const toDate = toIsoDate(range.to);

  const pageRows = (await fetchPageDaily(fromDate, toDate)).filter(
    (r) => r.pageRoute === pageRoute,
  );
  const compRows = (await fetchComponentDaily(fromDate, toDate)).filter(
    (r) => r.pageRoute === pageRoute,
  );

  const totalPageViews = sumBy(pageRows, (r) => r.pageViews);
  const totalSessions = sumBy(pageRows, (r) => r.uniqueSessions);

  // Top events sur la page : on regroupe les insights_component_daily par event_name
  // (les events sans composant sont comptés via insights_event_daily, à terme une vue dédiée serait mieux)
  const eventsAgg = new Map<string, number>();
  for (const c of compRows) eventsAgg.set(c.eventName, (eventsAgg.get(c.eventName) ?? 0) + c.count);
  const eventTotal = Array.from(eventsAgg.values()).reduce((a, b) => a + b, 0);
  const events = Array.from(eventsAgg.entries())
    .map(([eventName, count]) => ({
      eventName,
      count,
      share: eventTotal > 0 ? count / eventTotal : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const componentsAgg = new Map<string, { name: string | null; count: number }>();
  for (const c of compRows) {
    const slot = componentsAgg.get(c.componentId) ?? { name: c.componentName, count: 0 };
    slot.count += c.count;
    componentsAgg.set(c.componentId, slot);
  }
  const components = Array.from(componentsAgg.entries())
    .map(([componentId, v]) => ({
      componentId,
      componentName: v.name,
      count: v.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const days = listDays(range.from, range.to);
  const dailyMap = new Map<string, InsightsTimeseriesPoint>();
  for (const r of pageRows) {
    dailyMap.set(r.date, {
      date: r.date,
      events: r.eventsTotal,
      sessions: r.uniqueSessions,
      conversions: r.conversions,
    });
  }
  const daily = days.map(
    (d) => dailyMap.get(d) ?? { date: d, events: 0, sessions: 0, conversions: 0 },
  );

  return {
    pageRoute,
    pageViews: totalPageViews,
    sessions: totalSessions,
    events,
    components,
    daily,
  };
}

function groupPages(rows: InsightsPageDailyRow[]): PageRow[] {
  const map = new Map<string, PageRow>();
  for (const r of rows) {
    const slot =
      map.get(r.pageRoute) ??
      ({
        pageRoute: r.pageRoute,
        pageViews: 0,
        sessions: 0,
        visitors: 0,
        scroll75: 0,
        conversions: 0,
        bounceCount: 0,
        bounceRate: 0,
        avgTimeSeconds: 0,
      } satisfies PageRow);
    slot.pageViews += r.pageViews;
    slot.sessions += r.uniqueSessions;
    slot.visitors += r.uniqueVisitors;
    slot.scroll75 += r.scroll75Count;
    slot.conversions += r.conversions;
    slot.bounceCount += r.bounceCount;
    map.set(r.pageRoute, slot);
  }
  // Compute bounceRate + avgTime weighted
  for (const slot of map.values()) {
    slot.bounceRate = slot.sessions > 0 ? slot.bounceCount / slot.sessions : 0;
  }
  // avgTime weighted
  const avgWeights = new Map<string, { totalDuration: number; weight: number }>();
  for (const r of rows) {
    if (r.avgTimeSeconds <= 0 || r.uniqueSessions <= 0) continue;
    const slot = avgWeights.get(r.pageRoute) ?? { totalDuration: 0, weight: 0 };
    slot.totalDuration += r.avgTimeSeconds * r.uniqueSessions;
    slot.weight += r.uniqueSessions;
    avgWeights.set(r.pageRoute, slot);
  }
  for (const [route, w] of avgWeights) {
    const slot = map.get(route);
    if (slot && w.weight > 0) slot.avgTimeSeconds = Math.round(w.totalDuration / w.weight);
  }
  return Array.from(map.values());
}

/* ═════════════════════════════════════════════════════════════════
 * COMPONENTS
 * ═════════════════════════════════════════════════════════════════ */

export async function getComponentsTop(
  filters: InsightsFilters,
  limit = 50,
  now: Date = new Date(),
): Promise<ComponentsResponse> {
  const range = resolveInsightsRange(filters, now);
  const rows = await fetchComponentDaily(toIsoDate(range.from), toIsoDate(range.to));
  const grouped = groupComponents(rows);
  grouped.sort((a, b) => b.total - a.total);
  return {
    components: grouped.slice(0, limit),
    totalRows: grouped.length,
  };
}

export async function getComponentDetail(
  componentId: string,
  filters: InsightsFilters,
  now: Date = new Date(),
): Promise<ComponentDetailResponse> {
  const range = resolveInsightsRange(filters, now);
  const rows = (await fetchComponentDaily(
    toIsoDate(range.from),
    toIsoDate(range.to),
  )).filter((r) => r.componentId === componentId);

  const total = sumBy(rows, (r) => r.count);
  const componentName = rows[0]?.componentName ?? null;

  const evMap = new Map<string, number>();
  for (const r of rows) evMap.set(r.eventName, (evMap.get(r.eventName) ?? 0) + r.count);
  const events = Array.from(evMap.entries())
    .map(([eventName, count]) => ({
      eventName,
      count,
      share: total > 0 ? count / total : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const pgMap = new Map<string, number>();
  for (const r of rows) {
    const route = r.pageRoute ?? '(unknown)';
    pgMap.set(route, (pgMap.get(route) ?? 0) + r.count);
  }
  const pages = Array.from(pgMap.entries())
    .map(([pageRoute, count]) => ({ pageRoute, count }))
    .sort((a, b) => b.count - a.count);

  const days = listDays(range.from, range.to);
  const dailyMap = new Map<string, number>();
  for (const r of rows) dailyMap.set(r.date, (dailyMap.get(r.date) ?? 0) + r.count);
  const daily = days.map((d) => ({ date: d, count: dailyMap.get(d) ?? 0 }));

  return { componentId, componentName, total, events, pages, daily };
}

export async function getDeadComponents(
  filters: InsightsFilters,
  now: Date = new Date(),
): Promise<DeadComponentsResponse> {
  const range = resolveInsightsRange(filters, now);
  const rows = await fetchComponentDaily(toIsoDate(range.from), toIsoDate(range.to));
  const seen = new Set(rows.map((r) => r.componentId));

  const drizzle = db();
  let allComponents: { id: string; name: string; category: string | null }[];
  if (drizzle) {
    const dbRows = await drizzle
      .select({
        id: schema.trackingComponents.id,
        name: schema.trackingComponents.name,
      })
      .from(schema.trackingComponents);
    allComponents = dbRows.map((c) => ({ id: c.id, name: c.name, category: null }));
  } else {
    allComponents = Array.from(memoryStore().trackingComponents.values()).map((c) => ({
      id: c.id,
      name: c.name,
      category: null,
    }));
  }

  const dead = allComponents
    .filter((c) => !seen.has(c.id))
    .map((c) => ({
      componentId: c.id,
      componentName: c.name,
      category: c.category,
    }));

  return { components: dead };
}

function groupComponents(rows: InsightsComponentDailyRow[]): ComponentRow[] {
  const map = new Map<string, ComponentRow & { eventCounts: Map<string, number> }>();
  for (const r of rows) {
    const key = r.componentId;
    const slot =
      map.get(key) ??
      ({
        componentId: r.componentId,
        componentName: r.componentName,
        pageRoute: r.pageRoute,
        total: 0,
        topEvent: r.eventName,
        conversionCount: 0,
        eventCounts: new Map<string, number>(),
      } as ComponentRow & { eventCounts: Map<string, number> });
    slot.total += r.count;
    slot.conversionCount += r.conversionCount;
    slot.eventCounts.set(r.eventName, (slot.eventCounts.get(r.eventName) ?? 0) + r.count);
    if (slot.componentName === null && r.componentName) slot.componentName = r.componentName;
    map.set(key, slot);
  }
  return Array.from(map.values()).map((s) => {
    let top = s.topEvent;
    let topCount = 0;
    for (const [name, count] of s.eventCounts) {
      if (count > topCount) {
        top = name;
        topCount = count;
      }
    }
    return {
      componentId: s.componentId,
      componentName: s.componentName,
      pageRoute: s.pageRoute,
      total: s.total,
      topEvent: top,
      conversionCount: s.conversionCount,
    };
  });
}

/* ═════════════════════════════════════════════════════════════════
 * SECTIONS
 * ═════════════════════════════════════════════════════════════════ */

export async function getSectionsTop(
  filters: InsightsFilters,
  limit = 30,
  now: Date = new Date(),
): Promise<SectionsResponse> {
  const range = resolveInsightsRange(filters, now);
  const rows = await fetchSectionDaily(toIsoDate(range.from), toIsoDate(range.to));
  const map = new Map<string, SectionRow & { weighted: number; weight: number }>();
  for (const r of rows) {
    const key = `${r.pageRoute}|${r.sectionId}`;
    const slot =
      map.get(key) ??
      ({
        sectionId: r.sectionId,
        pageRoute: r.pageRoute,
        views: 0,
        avgDwellSeconds: 0,
        uniqueSessions: 0,
        weighted: 0,
        weight: 0,
      } as SectionRow & { weighted: number; weight: number });
    slot.views += r.views;
    slot.uniqueSessions += r.uniqueSessions;
    if (r.views > 0) {
      slot.weighted += r.avgDwellSeconds * r.views;
      slot.weight += r.views;
    }
    map.set(key, slot);
  }
  const out = Array.from(map.values()).map((s) => ({
    sectionId: s.sectionId,
    pageRoute: s.pageRoute,
    views: s.views,
    uniqueSessions: s.uniqueSessions,
    avgDwellSeconds: s.weight > 0 ? Math.round(s.weighted / s.weight) : 0,
  }));
  out.sort((a, b) => b.avgDwellSeconds - a.avgDwellSeconds);
  return { sections: out.slice(0, limit), totalRows: out.length };
}

/* ═════════════════════════════════════════════════════════════════
 * FUNNEL
 * ═════════════════════════════════════════════════════════════════ */

export async function getFunnel(
  filters: InsightsFilters,
  now: Date = new Date(),
): Promise<FunnelResponse> {
  const range = resolveInsightsRange(filters, now);
  const rows = await fetchFunnelDaily(toIsoDate(range.from), toIsoDate(range.to));
  const totals = {
    view_item: sumBy(rows, (r) => r.viewItem),
    add_to_cart: sumBy(rows, (r) => r.addToCart),
    begin_checkout: sumBy(rows, (r) => r.beginCheckout),
    add_payment_info: sumBy(rows, (r) => r.addPaymentInfo),
    purchase: sumBy(rows, (r) => r.purchase),
  };
  const order: (keyof typeof totals)[] = [
    'view_item',
    'add_to_cart',
    'begin_checkout',
    'add_payment_info',
    'purchase',
  ];
  const stages: FunnelStage[] = order.map((name, idx) => {
    const count = totals[name];
    const prevName = idx === 0 ? null : order[idx - 1]!;
    const prev = prevName ? totals[prevName] : null;
    return {
      name,
      count,
      conversionFromPrev: prev !== null && prev > 0 ? count / prev : null,
    };
  });
  const dropoffs: FunnelDropoff[] = [];
  for (let i = 1; i < order.length; i++) {
    const fromStage = order[i - 1]!;
    const toStage = order[i]!;
    const prev = totals[fromStage];
    const cur = totals[toStage];
    const lost = prev - cur;
    dropoffs.push({
      fromStage,
      toStage,
      lost,
      percent: prev > 0 ? -(lost / prev) : 0,
    });
  }
  return {
    stages,
    dropoffs,
    totalRevenueCents: sumBy(rows, (r) => r.revenueTotalCents),
    uniquePurchasers: sumBy(rows, (r) => r.uniquePurchasers),
  };
}

/* ═════════════════════════════════════════════════════════════════
 * Fetch helpers (Drizzle / memoryStore)
 * ═════════════════════════════════════════════════════════════════ */

async function fetchEventDaily(
  fromDate: string,
  toDate: string,
  filters: InsightsFilters,
): Promise<InsightsEventDailyRow[]> {
  const drizzle = db();
  if (drizzle) {
    const conditions = [
      gte(schema.insightsEventDaily.date, fromDate),
      lt(schema.insightsEventDaily.date, toDate),
    ];
    if (filters.env !== 'all') conditions.push(eq(schema.insightsEventDaily.env, filters.env));
    if (filters.device !== 'all') conditions.push(eq(schema.insightsEventDaily.device, filters.device));
    if (filters.locale !== 'all') conditions.push(eq(schema.insightsEventDaily.locale, filters.locale));
    const rows = await drizzle
      .select()
      .from(schema.insightsEventDaily)
      .where(and(...conditions));
    return rows as InsightsEventDailyRow[];
  }
  return Array.from(memoryStore().insightsEventDaily.values()).filter((r) => {
    if (r.date < fromDate || r.date >= toDate) return false;
    if (filters.env !== 'all' && r.env !== filters.env) return false;
    if (filters.device !== 'all' && r.device !== filters.device) return false;
    if (filters.locale !== 'all' && r.locale !== filters.locale) return false;
    return true;
  });
}

async function fetchPageDaily(
  fromDate: string,
  toDate: string,
): Promise<InsightsPageDailyRow[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.insightsPageDaily)
      .where(
        and(
          gte(schema.insightsPageDaily.date, fromDate),
          lt(schema.insightsPageDaily.date, toDate),
        ),
      );
    return rows as InsightsPageDailyRow[];
  }
  return Array.from(memoryStore().insightsPageDaily.values()).filter(
    (r) => r.date >= fromDate && r.date < toDate,
  );
}

async function fetchComponentDaily(
  fromDate: string,
  toDate: string,
): Promise<InsightsComponentDailyRow[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.insightsComponentDaily)
      .where(
        and(
          gte(schema.insightsComponentDaily.date, fromDate),
          lt(schema.insightsComponentDaily.date, toDate),
        ),
      );
    return rows as InsightsComponentDailyRow[];
  }
  return Array.from(memoryStore().insightsComponentDaily.values()).filter(
    (r) => r.date >= fromDate && r.date < toDate,
  );
}

async function fetchSectionDaily(
  fromDate: string,
  toDate: string,
): Promise<InsightsSectionDailyRow[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.insightsSectionDaily)
      .where(
        and(
          gte(schema.insightsSectionDaily.date, fromDate),
          lt(schema.insightsSectionDaily.date, toDate),
        ),
      );
    return rows as InsightsSectionDailyRow[];
  }
  return Array.from(memoryStore().insightsSectionDaily.values()).filter(
    (r) => r.date >= fromDate && r.date < toDate,
  );
}

async function fetchFunnelDaily(
  fromDate: string,
  toDate: string,
): Promise<InsightsFunnelDailyRow[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.insightsFunnelDaily)
      .where(
        and(
          gte(schema.insightsFunnelDaily.date, fromDate),
          lt(schema.insightsFunnelDaily.date, toDate),
        ),
      );
    return rows as InsightsFunnelDailyRow[];
  }
  return Array.from(memoryStore().insightsFunnelDaily.values()).filter(
    (r) => r.date >= fromDate && r.date < toDate,
  );
}

function sumBy<T>(arr: T[], picker: (v: T) => number): number {
  let s = 0;
  for (const v of arr) s += picker(v);
  return s;
}
