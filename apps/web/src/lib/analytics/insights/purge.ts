/**
 * Purge des tables `insights_*` selon la politique de retention.
 * cf. docs/analytics-insights/02-data.md §10
 */
import { lt, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { db, memoryStore, schema } from '@/lib/db/client';
import { addDays, toIsoDate } from './filters';

export interface InsightsPurgeResult {
  cutoffDates: Record<string, string>;
  purged: Record<string, number>;
}

const RETENTION_DAYS = {
  event: 24 * 30, // 24 mois
  page: 24 * 30,
  component: 12 * 30, // 12 mois
  section: 12 * 30,
  funnel: 36 * 30, // 36 mois
} as const;

const RUN_RETENTION_DAYS = 90;

export async function purgeInsights(now: Date = new Date()): Promise<InsightsPurgeResult> {
  const cutoffDates: Record<string, string> = {
    event: toIsoDate(addDays(now, -RETENTION_DAYS.event)),
    page: toIsoDate(addDays(now, -RETENTION_DAYS.page)),
    component: toIsoDate(addDays(now, -RETENTION_DAYS.component)),
    section: toIsoDate(addDays(now, -RETENTION_DAYS.section)),
    funnel: toIsoDate(addDays(now, -RETENTION_DAYS.funnel)),
  };
  const runCutoff = new Date(now.getTime() - RUN_RETENTION_DAYS * 86_400_000);

  const purged: Record<string, number> = {};
  const drizzle = db();

  if (drizzle) {
    // Postgres : on lit la quantité avant DELETE pour rester portable
    purged.event = await deleteCount(
      drizzle,
      schema.insightsEventDaily,
      lt(schema.insightsEventDaily.date, cutoffDates.event!),
    );
    purged.page = await deleteCount(
      drizzle,
      schema.insightsPageDaily,
      lt(schema.insightsPageDaily.date, cutoffDates.page!),
    );
    purged.component = await deleteCount(
      drizzle,
      schema.insightsComponentDaily,
      lt(schema.insightsComponentDaily.date, cutoffDates.component!),
    );
    purged.section = await deleteCount(
      drizzle,
      schema.insightsSectionDaily,
      lt(schema.insightsSectionDaily.date, cutoffDates.section!),
    );
    purged.funnel = await deleteCount(
      drizzle,
      schema.insightsFunnelDaily,
      lt(schema.insightsFunnelDaily.date, cutoffDates.funnel!),
    );
    purged.run = await deleteCount(
      drizzle,
      schema.insightsRefreshRun,
      lt(schema.insightsRefreshRun.startedAt, runCutoff),
    );
  } else {
    const store = memoryStore();
    purged.event = deleteFromMap(store.insightsEventDaily, (r) => r.date < cutoffDates.event!);
    purged.page = deleteFromMap(store.insightsPageDaily, (r) => r.date < cutoffDates.page!);
    purged.component = deleteFromMap(
      store.insightsComponentDaily,
      (r) => r.date < cutoffDates.component!,
    );
    purged.section = deleteFromMap(
      store.insightsSectionDaily,
      (r) => r.date < cutoffDates.section!,
    );
    purged.funnel = deleteFromMap(
      store.insightsFunnelDaily,
      (r) => r.date < cutoffDates.funnel!,
    );
    purged.run = deleteFromMap(
      store.insightsRefreshRun,
      (r) => r.startedAt < runCutoff,
    );
  }

  return { cutoffDates: { ...cutoffDates, run: runCutoff.toISOString() }, purged };
}

function deleteFromMap<K, V>(map: Map<K, V>, predicate: (v: V) => boolean): number {
  let n = 0;
  for (const [k, v] of map) {
    if (predicate(v)) {
      map.delete(k);
      n++;
    }
  }
  return n;
}

/**
 * Compte puis delete : portable Neon-http + postgres-js (rowCount n'est pas
 * uniformément exposé entre les drivers).
 */
async function deleteCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  drizzle: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: PgTable<any>,
  whereClause: SQL,
): Promise<number> {
  const matched = await drizzle.select({ id: table }).from(table).where(whereClause);
  await drizzle.delete(table).where(whereClause);
  return Array.isArray(matched) ? matched.length : 0;
}
