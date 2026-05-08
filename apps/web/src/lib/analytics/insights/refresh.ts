/**
 * Orchestrateur de refresh Analytics Insights.
 * cf. docs/analytics-insights/07-refresh-orchestration.md
 *
 * Pipeline :
 *   1. Acquérir un lock pessimiste (insights_refresh_run.status='running')
 *   2. Vérifier le toggle ON/OFF (skip si OFF)
 *   3. Fetch les events depuis tracking_events_log (incrémental + 24h cushion)
 *   4. Agréger via aggregate.ts (en TS, portable Postgres + memoryStore)
 *   5. Upsert dans les 5 tables insights_*
 *   6. Persister le run avec status=success/failed et les durations/counts
 *   7. Relâcher le lock
 *
 * Le lock orphelin (>5 min en running) est écrasé.
 */
import { and, desc, eq, gt, gte, lt, max } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import { logger } from '@/lib/logging/logger';
import type {
  TrackingEventLogEntry,
  InsightsComponentDailyRow,
  InsightsEventDailyRow,
  InsightsFunnelDailyRow,
  InsightsPageDailyRow,
  InsightsSectionDailyRow,
  InsightsRefreshRunRow,
  InsightsRefreshTrigger,
  InsightsRefreshStatus,
} from '@/lib/db/types';
import { aggregateEvents, type AggregatedBatch } from './aggregate';
import type { InsightsRefreshResult, InsightsRefreshStatus as ApiRefreshStatus } from './contracts';
import { logInsightsAudit } from './audit';
import { getInsightsRefreshEnabled, getInsightsRefreshInterval } from './settings';

const LOCK_STALE_MS = 5 * 60 * 1000;
const BACKFILL_INITIAL_DAYS = 90;
const INCREMENTAL_CUSHION_MS = 24 * 60 * 60 * 1000;

export interface RefreshOptions {
  trigger: InsightsRefreshTrigger;
  actorId: string | null;
  /** Si true, force un refresh même si toggle OFF (pour tests/admin manuel). */
  force?: boolean;
}

export async function runInsightsRefresh(
  opts: RefreshOptions,
): Promise<InsightsRefreshResult> {
  const enabled = await getInsightsRefreshEnabled();
  if (!enabled && opts.trigger === 'cron' && !opts.force) {
    logger.info('insights.refresh.skipped', { reason: 'disabled' });
    return { ok: true, runId: null, durationsMs: {}, counts: {}, skipped: true, reason: 'disabled' };
  }

  // Vérifier qu'aucun autre run n'est actif
  const activeRun = await findActiveRun();
  if (activeRun) {
    logger.warn('insights.refresh.lock_held', { runId: activeRun.id, startedAt: activeRun.startedAt });
    const err = new Error('refresh_in_progress');
    (err as Error & { code?: string }).code = 'refresh_in_progress';
    throw err;
  }

  const runId = createId('irf');
  const startedAt = new Date();
  await persistRunStart(runId, opts.trigger, opts.actorId, startedAt);

  const durationsMs: Record<string, number> = {};
  const counts: Record<string, number> = {};
  let errCode: string | null = null;
  let errMessage: string | null = null;

  try {
    const tFetch = performance.now();
    const since = await computeIncrementalSince();
    const events = await fetchEventsSince(since);
    durationsMs.fetch = Math.round(performance.now() - tFetch);
    counts.fetch = events.length;

    const tAggregate = performance.now();
    const componentNames = await fetchComponentNames();
    const batch = aggregateEvents(events, componentNames, envOf);
    durationsMs.aggregate = Math.round(performance.now() - tAggregate);
    counts.event = batch.events.length;
    counts.page = batch.pages.length;
    counts.component = batch.components.length;
    counts.section = batch.sections.length;
    counts.funnel = batch.funnel.length;

    const tUpsert = performance.now();
    await upsertAggregations(batch);
    durationsMs.upsert = Math.round(performance.now() - tUpsert);

    const finishedAt = new Date();
    await persistRunSuccess(runId, finishedAt, durationsMs, counts);
    await logInsightsAudit({
      action: 'analytics.insights.refresh',
      actorId: opts.actorId,
      resourceId: runId,
      meta: { trigger: opts.trigger, status: 'success', durationsMs, counts },
    });
    logger.info('insights.refresh.success', { runId, durationsMs, counts });
    return { ok: true, runId, durationsMs, counts };
  } catch (err) {
    errCode = (err as Error & { code?: string }).code ?? 'internal_error';
    errMessage = err instanceof Error ? err.message : String(err);
    const finishedAt = new Date();
    await persistRunFailed(runId, finishedAt, durationsMs, counts, errCode, errMessage);
    await logInsightsAudit({
      action: 'analytics.insights.refresh',
      actorId: opts.actorId,
      resourceId: runId,
      meta: { trigger: opts.trigger, status: 'failed', errorCode: errCode, errorMessage: errMessage },
    });
    logger.error('insights.refresh.failed', { runId, errCode, errMessage });
    throw err;
  }
}

export async function getInsightsRefreshStatus(): Promise<ApiRefreshStatus> {
  const last = await findLastRun();
  const lockHeld = (await findActiveRun()) !== null;
  const enabled = await getInsightsRefreshEnabled();
  const intervalMinutes = await getInsightsRefreshInterval();
  return {
    lastRun: last
      ? {
          id: last.id,
          trigger: last.trigger,
          status: last.status,
          startedAt: last.startedAt.toISOString(),
          finishedAt: last.finishedAt ? last.finishedAt.toISOString() : null,
          durationsMs: last.durationsMs,
          counts: last.counts,
          errorCode: last.errorCode,
          errorMessage: last.errorMessage,
          triggeredBy: last.triggeredBy,
        }
      : null,
    lockHeld,
    enabled,
    intervalMinutes,
  };
}

/* ─────────────────────────────────────────────────────────────────
 * Lock pessimiste
 * ───────────────────────────────────────────────────────────────── */

async function findActiveRun(): Promise<InsightsRefreshRunRow | null> {
  const drizzle = db();
  const cutoff = new Date(Date.now() - LOCK_STALE_MS);
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.insightsRefreshRun)
      .where(
        and(
          eq(schema.insightsRefreshRun.status, 'running'),
          gt(schema.insightsRefreshRun.startedAt, cutoff),
        ),
      )
      .orderBy(desc(schema.insightsRefreshRun.startedAt))
      .limit(1);
    return rows[0] ? rowToRun(rows[0]) : null;
  }
  const store = memoryStore();
  let active: InsightsRefreshRunRow | null = null;
  for (const r of store.insightsRefreshRun.values()) {
    if (r.status === 'running' && r.startedAt > cutoff) {
      if (!active || r.startedAt > active.startedAt) active = r;
    }
  }
  return active;
}

async function findLastRun(): Promise<InsightsRefreshRunRow | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.insightsRefreshRun)
      .orderBy(desc(schema.insightsRefreshRun.startedAt))
      .limit(1);
    return rows[0] ? rowToRun(rows[0]) : null;
  }
  const store = memoryStore();
  let last: InsightsRefreshRunRow | null = null;
  for (const r of store.insightsRefreshRun.values()) {
    if (!last || r.startedAt > last.startedAt) last = r;
  }
  return last;
}

async function persistRunStart(
  id: string,
  trigger: InsightsRefreshTrigger,
  actorId: string | null,
  startedAt: Date,
): Promise<void> {
  const row: InsightsRefreshRunRow = {
    id,
    trigger,
    status: 'running',
    startedAt,
    finishedAt: null,
    durationsMs: {},
    counts: {},
    errorCode: null,
    errorMessage: null,
    triggeredBy: actorId,
  };
  const drizzle = db();
  if (drizzle) {
    await drizzle.insert(schema.insightsRefreshRun).values({
      id,
      trigger,
      status: 'running',
      startedAt,
      finishedAt: null,
      durationsMs: {},
      counts: {},
      errorCode: null,
      errorMessage: null,
      triggeredBy: actorId,
    });
  } else {
    memoryStore().insightsRefreshRun.set(id, row);
  }
}

async function persistRunSuccess(
  id: string,
  finishedAt: Date,
  durationsMs: Record<string, number>,
  counts: Record<string, number>,
): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(schema.insightsRefreshRun)
      .set({
        status: 'success',
        finishedAt,
        durationsMs,
        counts,
      })
      .where(eq(schema.insightsRefreshRun.id, id));
  } else {
    const store = memoryStore();
    const r = store.insightsRefreshRun.get(id);
    if (r) {
      store.insightsRefreshRun.set(id, {
        ...r,
        status: 'success',
        finishedAt,
        durationsMs,
        counts,
      });
    }
  }
}

async function persistRunFailed(
  id: string,
  finishedAt: Date,
  durationsMs: Record<string, number>,
  counts: Record<string, number>,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .update(schema.insightsRefreshRun)
      .set({
        status: 'failed',
        finishedAt,
        durationsMs,
        counts,
        errorCode,
        errorMessage,
      })
      .where(eq(schema.insightsRefreshRun.id, id));
  } else {
    const store = memoryStore();
    const r = store.insightsRefreshRun.get(id);
    if (r) {
      store.insightsRefreshRun.set(id, {
        ...r,
        status: 'failed',
        finishedAt,
        durationsMs,
        counts,
        errorCode,
        errorMessage,
      });
    }
  }
}

function rowToRun(r: typeof schema.insightsRefreshRun.$inferSelect): InsightsRefreshRunRow {
  return {
    id: r.id,
    trigger: r.trigger as InsightsRefreshTrigger,
    status: r.status as InsightsRefreshStatus,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt ?? null,
    durationsMs: (r.durationsMs as Record<string, number>) ?? {},
    counts: (r.counts as Record<string, number>) ?? {},
    errorCode: r.errorCode ?? null,
    errorMessage: r.errorMessage ?? null,
    triggeredBy: r.triggeredBy ?? null,
  };
}

/* ─────────────────────────────────────────────────────────────────
 * Bornes incrémentales
 * ───────────────────────────────────────────────────────────────── */

async function computeIncrementalSince(): Promise<Date> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select({ max: max(schema.insightsEventDaily.refreshedAt) })
      .from(schema.insightsEventDaily);
    const maxAt = rows[0]?.max as Date | null | undefined;
    if (maxAt) return new Date(maxAt.getTime() - INCREMENTAL_CUSHION_MS);
  } else {
    let maxAt: Date | null = null;
    for (const r of memoryStore().insightsEventDaily.values()) {
      if (!maxAt || r.refreshedAt > maxAt) maxAt = r.refreshedAt;
    }
    if (maxAt) return new Date(maxAt.getTime() - INCREMENTAL_CUSHION_MS);
  }
  // Backfill initial : 90 jours en arrière
  return new Date(Date.now() - BACKFILL_INITIAL_DAYS * 24 * 60 * 60 * 1000);
}

async function fetchEventsSince(since: Date): Promise<TrackingEventLogEntry[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.trackingEventsLog)
      .where(gte(schema.trackingEventsLog.receivedAt, since));
    return rows as unknown as TrackingEventLogEntry[];
  }
  const store = memoryStore();
  return Array.from(store.trackingEventsLog.values()).filter((e) => e.receivedAt >= since);
}

async function fetchComponentNames(): Promise<Map<string, string>> {
  const drizzle = db();
  const map = new Map<string, string>();
  if (drizzle) {
    const rows = await drizzle
      .select({ id: schema.trackingComponents.id, name: schema.trackingComponents.name })
      .from(schema.trackingComponents);
    for (const r of rows) map.set(r.id, r.name);
    return map;
  }
  for (const c of memoryStore().trackingComponents.values()) map.set(c.id, c.name);
  return map;
}

function envOf(_e: TrackingEventLogEntry): string {
  // Pour l'instant, on assume `production` partout. Si on veut différencier
  // preview/dev, on peut lire depuis le payload ou l'origine.
  return process.env.VERCEL_ENV ?? 'production';
}

/* ─────────────────────────────────────────────────────────────────
 * Upsert dans les 5 tables insights_*
 * ───────────────────────────────────────────────────────────────── */

async function upsertAggregations(batch: AggregatedBatch): Promise<void> {
  const drizzle = db();
  if (drizzle) {
    // Postgres : ON CONFLICT DO UPDATE
    await upsertEventsPg(batch.events);
    await upsertPagesPg(batch.pages);
    await upsertComponentsPg(batch.components);
    await upsertSectionsPg(batch.sections);
    await upsertFunnelPg(batch.funnel);
  } else {
    upsertEventsMem(batch.events);
    upsertPagesMem(batch.pages);
    upsertComponentsMem(batch.components);
    upsertSectionsMem(batch.sections);
    upsertFunnelMem(batch.funnel);
  }
}

async function upsertEventsPg(rows: InsightsEventDailyRow[]): Promise<void> {
  if (rows.length === 0) return;
  const drizzle = db()!;
  for (const r of rows) {
    await drizzle
      .insert(schema.insightsEventDaily)
      .values(r)
      .onConflictDoUpdate({
        target: [
          schema.insightsEventDaily.date,
          schema.insightsEventDaily.eventName,
          schema.insightsEventDaily.env,
          schema.insightsEventDaily.device,
          schema.insightsEventDaily.locale,
        ],
        set: {
          count: r.count,
          uniqueSessions: r.uniqueSessions,
          conversionCount: r.conversionCount,
          refreshedAt: new Date(),
        },
      });
  }
}

async function upsertPagesPg(rows: InsightsPageDailyRow[]): Promise<void> {
  if (rows.length === 0) return;
  const drizzle = db()!;
  for (const r of rows) {
    await drizzle
      .insert(schema.insightsPageDaily)
      .values(r)
      .onConflictDoUpdate({
        target: [schema.insightsPageDaily.date, schema.insightsPageDaily.pageRoute],
        set: {
          pageViews: r.pageViews,
          uniqueSessions: r.uniqueSessions,
          uniqueVisitors: r.uniqueVisitors,
          eventsTotal: r.eventsTotal,
          scroll75Count: r.scroll75Count,
          conversions: r.conversions,
          bounceCount: r.bounceCount,
          avgTimeSeconds: r.avgTimeSeconds,
          refreshedAt: new Date(),
        },
      });
  }
}

async function upsertComponentsPg(rows: InsightsComponentDailyRow[]): Promise<void> {
  if (rows.length === 0) return;
  const drizzle = db()!;
  for (const r of rows) {
    await drizzle
      .insert(schema.insightsComponentDaily)
      .values(r)
      .onConflictDoUpdate({
        target: [
          schema.insightsComponentDaily.date,
          schema.insightsComponentDaily.componentId,
          schema.insightsComponentDaily.eventName,
          schema.insightsComponentDaily.pageRoute,
        ],
        set: {
          count: r.count,
          uniqueSessions: r.uniqueSessions,
          conversionCount: r.conversionCount,
          componentName: r.componentName,
          refreshedAt: new Date(),
        },
      });
  }
}

async function upsertSectionsPg(rows: InsightsSectionDailyRow[]): Promise<void> {
  if (rows.length === 0) return;
  const drizzle = db()!;
  for (const r of rows) {
    await drizzle
      .insert(schema.insightsSectionDaily)
      .values(r)
      .onConflictDoUpdate({
        target: [
          schema.insightsSectionDaily.date,
          schema.insightsSectionDaily.pageRoute,
          schema.insightsSectionDaily.sectionId,
        ],
        set: {
          views: r.views,
          avgDwellSeconds: r.avgDwellSeconds,
          uniqueSessions: r.uniqueSessions,
          refreshedAt: new Date(),
        },
      });
  }
}

async function upsertFunnelPg(rows: InsightsFunnelDailyRow[]): Promise<void> {
  if (rows.length === 0) return;
  const drizzle = db()!;
  for (const r of rows) {
    await drizzle
      .insert(schema.insightsFunnelDaily)
      .values(r)
      .onConflictDoUpdate({
        target: [schema.insightsFunnelDaily.date],
        set: {
          viewItem: r.viewItem,
          addToCart: r.addToCart,
          beginCheckout: r.beginCheckout,
          addPaymentInfo: r.addPaymentInfo,
          purchase: r.purchase,
          generateLead: r.generateLead,
          uniquePurchasers: r.uniquePurchasers,
          revenueTotalCents: r.revenueTotalCents,
          refreshedAt: new Date(),
        },
      });
  }
}

function upsertEventsMem(rows: InsightsEventDailyRow[]): void {
  const store = memoryStore();
  for (const r of rows) {
    const key = `${r.date}|${r.eventName}|${r.env}|${r.device}|${r.locale}`;
    let existing: InsightsEventDailyRow | null = null;
    for (const e of store.insightsEventDaily.values()) {
      if (
        e.date === r.date &&
        e.eventName === r.eventName &&
        e.env === r.env &&
        e.device === r.device &&
        e.locale === r.locale
      ) {
        existing = e;
        break;
      }
    }
    if (existing) {
      store.insightsEventDaily.set(existing.id, {
        ...existing,
        count: r.count,
        uniqueSessions: r.uniqueSessions,
        conversionCount: r.conversionCount,
        refreshedAt: new Date(),
      });
    } else {
      store.insightsEventDaily.set(r.id, { ...r, refreshedAt: new Date() });
    }
  }
}

function upsertPagesMem(rows: InsightsPageDailyRow[]): void {
  const store = memoryStore();
  for (const r of rows) {
    let existing: InsightsPageDailyRow | null = null;
    for (const e of store.insightsPageDaily.values()) {
      if (e.date === r.date && e.pageRoute === r.pageRoute) {
        existing = e;
        break;
      }
    }
    if (existing) {
      store.insightsPageDaily.set(existing.id, { ...existing, ...r, id: existing.id, refreshedAt: new Date() });
    } else {
      store.insightsPageDaily.set(r.id, { ...r, refreshedAt: new Date() });
    }
  }
}

function upsertComponentsMem(rows: InsightsComponentDailyRow[]): void {
  const store = memoryStore();
  for (const r of rows) {
    let existing: InsightsComponentDailyRow | null = null;
    for (const e of store.insightsComponentDaily.values()) {
      if (
        e.date === r.date &&
        e.componentId === r.componentId &&
        e.eventName === r.eventName &&
        e.pageRoute === r.pageRoute
      ) {
        existing = e;
        break;
      }
    }
    if (existing) {
      store.insightsComponentDaily.set(existing.id, { ...existing, ...r, id: existing.id, refreshedAt: new Date() });
    } else {
      store.insightsComponentDaily.set(r.id, { ...r, refreshedAt: new Date() });
    }
  }
}

function upsertSectionsMem(rows: InsightsSectionDailyRow[]): void {
  const store = memoryStore();
  for (const r of rows) {
    let existing: InsightsSectionDailyRow | null = null;
    for (const e of store.insightsSectionDaily.values()) {
      if (e.date === r.date && e.pageRoute === r.pageRoute && e.sectionId === r.sectionId) {
        existing = e;
        break;
      }
    }
    if (existing) {
      store.insightsSectionDaily.set(existing.id, { ...existing, ...r, id: existing.id, refreshedAt: new Date() });
    } else {
      store.insightsSectionDaily.set(r.id, { ...r, refreshedAt: new Date() });
    }
  }
}

function upsertFunnelMem(rows: InsightsFunnelDailyRow[]): void {
  const store = memoryStore();
  for (const r of rows) {
    let existing: InsightsFunnelDailyRow | null = null;
    for (const e of store.insightsFunnelDaily.values()) {
      if (e.date === r.date) {
        existing = e;
        break;
      }
    }
    if (existing) {
      store.insightsFunnelDaily.set(existing.id, { ...existing, ...r, id: existing.id, refreshedAt: new Date() });
    } else {
      store.insightsFunnelDaily.set(r.id, { ...r, refreshedAt: new Date() });
    }
  }
}
