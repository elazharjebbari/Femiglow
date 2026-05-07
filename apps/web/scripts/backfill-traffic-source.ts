/**
 * Script de backfill : remplit `traffic_source` / `traffic_medium` sur les
 * lignes de `tracking_events_log` antérieures à la migration 0009.
 * cf. docs/analytics/07-runbook-roadmap.md §M0
 *
 * Usage :
 *   npm run backfill:traffic-source -- --from 2026-01-01 --to 2026-05-01
 *   npm run backfill:traffic-source -- --dry-run
 *
 * Stratégie :
 *   1. Itérer page par page (LIMIT 5000) pour ne pas exploser la mémoire.
 *   2. Lire `payload.referrer` (si présent) + `payload.utm_source/medium`.
 *   3. Calculer le bucket via classifyTraffic.
 *   4. UPDATE seulement si la ligne a `traffic_source IS NULL` (idempotent).
 */
import { eq, and, gte, lt, isNull, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { trackingEventsLog } from '@/lib/db/schema';
import { classifyTraffic } from '@/lib/analytics/attribution';

interface CliOptions {
  from?: Date;
  to?: Date;
  batchSize: number;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { batchSize: 5000, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--from') opts.from = new Date(argv[++i]);
    else if (a === '--to') opts.to = new Date(argv[++i]);
    else if (a === '--batch') opts.batchSize = Math.max(100, parseInt(argv[++i], 10));
  }
  return opts;
}

interface BackfillStats {
  processed: number;
  updated: number;
  skipped: number;
  buckets: Record<string, number>;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const handle = db();
  if (!handle) {
    throw new Error('DATABASE_URL absent — le backfill nécessite une vraie DB.');
  }

  console.log(
    `[backfill] start dry_run=${args.dryRun} batch=${args.batchSize} from=${args.from?.toISOString() ?? 'all'} to=${args.to?.toISOString() ?? 'now'}`,
  );

  const stats: BackfillStats = { processed: 0, updated: 0, skipped: 0, buckets: {} };

  // Boucle par fenêtre temporelle pour éviter LIMIT/OFFSET coûteux.
  const baseConditions = [isNull(trackingEventsLog.trafficSource)];
  if (args.from) baseConditions.push(gte(trackingEventsLog.receivedAt, args.from));
  if (args.to) baseConditions.push(lt(trackingEventsLog.receivedAt, args.to));

  let cursor: Date | null = args.from ?? null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const conditions = [...baseConditions];
    if (cursor) conditions.push(gte(trackingEventsLog.receivedAt, cursor));

    const rows = await handle
      .select({
        id: trackingEventsLog.id,
        payload: trackingEventsLog.payload,
        receivedAt: trackingEventsLog.receivedAt,
      })
      .from(trackingEventsLog)
      .where(and(...conditions))
      .orderBy(trackingEventsLog.receivedAt)
      .limit(args.batchSize);

    if (rows.length === 0) break;

    for (const row of rows) {
      stats.processed++;
      const payload = row.payload as Record<string, unknown> | null;
      const referrer = (payload?.['referrer'] ?? payload?.['page_referrer']) as
        | string
        | undefined;
      const utm = {
        utm_source: payload?.['utm_source'] as string | undefined,
        utm_medium: payload?.['utm_medium'] as string | undefined,
      };
      const { source, medium } = classifyTraffic({ utm, referrer });

      stats.buckets[source] = (stats.buckets[source] ?? 0) + 1;

      if (args.dryRun) {
        stats.skipped++;
        continue;
      }

      try {
        await handle
          .update(trackingEventsLog)
          .set({ trafficSource: source, trafficMedium: medium })
          .where(eq(trackingEventsLog.id, row.id));
        stats.updated++;
      } catch (err) {
        console.error(`[backfill] update failed for id=${row.id}:`, err);
        stats.skipped++;
      }
    }

    // Avancer le curseur strictement au-delà du dernier élément traité.
    const last = rows[rows.length - 1];
    cursor = new Date(last.receivedAt.getTime() + 1);

    console.log(
      `[backfill] processed=${stats.processed} updated=${stats.updated} skipped=${stats.skipped}`,
    );
  }

  console.log('[backfill] done');
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((err) => {
  console.error('[backfill] fatal', err);
  process.exitCode = 1;
});

// Garde un export pour faciliter les tests unitaires (purement lecture du module).
export { parseArgs };
