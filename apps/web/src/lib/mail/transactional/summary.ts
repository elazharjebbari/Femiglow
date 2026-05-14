/**
 * summarizeOutbox — KPIs temps réel pour le header cockpit.
 *
 * 4 chiffres : delivered / queued / failed / hardBounced sur une
 * fenêtre temporelle (1h / 24h / 7d). + sparkline (12 buckets) +
 * comparaison vs même fenêtre J-1.
 *
 * Cf. docs/emailing/admin-evolution/01-data/05-queries-catalog.md
 */
import 'server-only';
import { and, gte, lt, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailOutbox } from '@/lib/db/schema-emails';

export type SummaryWindow = '1h' | '24h' | '7d';

export type SummaryResult = {
  window: SummaryWindow;
  delivered: number;
  queued: number;
  failed: number;
  hardBounced: number;
  /** 12 buckets de durée = window/12. Index 0 = plus ancien. */
  sparkline: { delivered: number; failed: number }[];
  /**
   * Comparaison vs même fenêtre J-1. Présent uniquement si la
   * comparaison est pertinente (windows 24h+).
   */
  comparison?: {
    deliveredPct: number;
    failedPct: number;
  };
};

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

function windowToMs(w: SummaryWindow): number {
  switch (w) {
    case '1h':
      return 3_600_000;
    case '24h':
      return 86_400_000;
    case '7d':
      return 7 * 86_400_000;
  }
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * @param windowName  Fenêtre temporelle
 * @param now         Référence (testabilité)
 */
export async function summarizeOutbox(
  windowName: SummaryWindow,
  now: Date = new Date(),
): Promise<SummaryResult> {
  const drizzle = requireDb();
  const windowMs = windowToMs(windowName);
  const start = new Date(now.getTime() - windowMs);

  // 1. KPI counts (agrégation FILTER)
  const [agg] = await drizzle
    .select({
      delivered: sql<number>`count(*) FILTER (WHERE ${emailOutbox.status} IN ('delivered','opened','clicked'))::int`,
      queued: sql<number>`count(*) FILTER (WHERE ${emailOutbox.status} IN ('pending','sending'))::int`,
      failed: sql<number>`count(*) FILTER (WHERE ${emailOutbox.status} IN ('failed','dlq'))::int`,
      hardBounced: sql<number>`count(*) FILTER (WHERE ${emailOutbox.status} = 'bounced_permanent')::int`,
    })
    .from(emailOutbox)
    .where(gte(emailOutbox.createdAt, start));

  // 2. Sparkline : 12 buckets de windowMs/12
  const bucketMs = Math.floor(windowMs / 12);
  const sparklineRows = await drizzle
    .select({
      bucket: sql<number>`floor(extract(epoch from (${emailOutbox.createdAt} - ${start.toISOString()}::timestamptz)) / ${bucketMs / 1000})::int`,
      delivered: sql<number>`count(*) FILTER (WHERE ${emailOutbox.status} IN ('delivered','opened','clicked'))::int`,
      failed: sql<number>`count(*) FILTER (WHERE ${emailOutbox.status} IN ('failed','dlq','bounced_permanent'))::int`,
    })
    .from(emailOutbox)
    .where(gte(emailOutbox.createdAt, start))
    .groupBy(sql`bucket`)
    .orderBy(sql`bucket`);

  const sparkline = Array.from({ length: 12 }, (_, i) => {
    const row = sparklineRows.find((r) => r.bucket === i);
    return { delivered: row?.delivered ?? 0, failed: row?.failed ?? 0 };
  });

  // 3. Comparaison J-1 (uniquement si window >= 24h pour pertinence)
  let comparison: SummaryResult['comparison'];
  if (windowName === '24h' || windowName === '7d') {
    const prevStart = new Date(start.getTime() - windowMs);
    const prevEnd = new Date(start.getTime());
    const [prev] = await drizzle
      .select({
        delivered: sql<number>`count(*) FILTER (WHERE ${emailOutbox.status} IN ('delivered','opened','clicked'))::int`,
        failed: sql<number>`count(*) FILTER (WHERE ${emailOutbox.status} IN ('failed','dlq','bounced_permanent'))::int`,
      })
      .from(emailOutbox)
      .where(and(gte(emailOutbox.createdAt, prevStart), lt(emailOutbox.createdAt, prevEnd)));

    comparison = {
      deliveredPct: pctChange(agg?.delivered ?? 0, prev?.delivered ?? 0),
      failedPct: pctChange(agg?.failed ?? 0, prev?.failed ?? 0),
    };
  }

  return {
    window: windowName,
    delivered: agg?.delivered ?? 0,
    queued: agg?.queued ?? 0,
    failed: agg?.failed ?? 0,
    hardBounced: agg?.hardBounced ?? 0,
    sparkline,
    comparison,
  };
}
