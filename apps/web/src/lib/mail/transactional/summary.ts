/**
 * summarizeOutbox — KPIs temps réel pour le header cockpit ET le
 * dashboard fenêtré (F03).
 *
 * Chiffres delivered / queued / failed / hardBounced / sent sur une
 * fenêtre temporelle (1h / 24h / 7d / 30d) + sparkline (12 buckets) +
 * comparaison vs même fenêtre précédente + webhookLastSuccessAt
 * (dernier event `delivered` reçu — base du tri-état « webhook muet »).
 *
 * L'enum est l'UNION des besoins cockpit (1h) et dashboard (30d) pour
 * éviter deux schémas divergents — chaque UI n'expose que sa partie.
 *
 * Cf. docs/emailing/admin-evolution/01-data/05-queries-catalog.md
 */
import 'server-only';
import { and, gte, lt, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailEvent, emailOutbox } from '@/lib/db/schema-emails';

export type SummaryWindow = '1h' | '24h' | '7d' | '30d';

export type SummaryResult = {
  window: SummaryWindow;
  delivered: number;
  queued: number;
  failed: number;
  hardBounced: number;
  /** F03 : status IN (sent, delivered, opened, clicked) — base du tri-état + pct. */
  sent: number;
  /** F03 : iso du dernier event `delivered` reçu (toutes fenêtres confondues), null si jamais. */
  webhookLastSuccessAt: string | null;
  /** 12 buckets de durée = window/12. Index 0 = plus ancien. */
  sparkline: { delivered: number; failed: number }[];
  /**
   * Comparaison vs même fenêtre précédente. Présent uniquement si la
   * comparaison est pertinente (windows 24h+ ; absent en 1h).
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
    case '30d':
      return 30 * 86_400_000;
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
      sent: sql<number>`count(*) FILTER (WHERE ${emailOutbox.status} IN ('sent','delivered','opened','clicked'))::int`,
    })
    .from(emailOutbox)
    .where(gte(emailOutbox.createdAt, start));

  // 1b. Dernier event delivered reçu (toutes fenêtres) — « webhook armé ? ».
  // max(ts) est index-friendly (idx (type, ts) recommandé, cf. spec F03 §1).
  const [webhookRow] = await drizzle
    .select({ last: sql<Date | string | null>`max(${emailEvent.ts})` })
    .from(emailEvent)
    .where(sql`${emailEvent.type} = 'delivered'`);
  const webhookLastSuccessAt = webhookRow?.last
    ? new Date(webhookRow.last).toISOString()
    : null;

  // 2. Sparkline : 12 buckets de windowMs/12
  const bucketMs = Math.floor(windowMs / 12);
  // `.as('bucket')` OBLIGATOIRE : drizzle n'aliase PAS un fragment sql brut —
  // sans lui le SQL émis n'a pas de colonne `bucket` et le GROUP BY plante
  // (42703), donc la route summary 500 silencieusement (bug attrapé F03-I).
  const sparklineRows = await drizzle
    .select({
      bucket:
        sql<number>`floor(extract(epoch from (${emailOutbox.createdAt} - ${start.toISOString()}::timestamptz)) / ${bucketMs / 1000})::int`.as(
          'bucket',
        ),
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

  // 3. Comparaison vs fenêtre précédente (uniquement si window >= 24h)
  let comparison: SummaryResult['comparison'];
  if (windowName === '24h' || windowName === '7d' || windowName === '30d') {
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
    sent: agg?.sent ?? 0,
    webhookLastSuccessAt,
    sparkline,
    comparison,
  };
}
