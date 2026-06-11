/**
 * Script de backfill v2 — remplit `traffic_source` / `traffic_medium` sur
 * les lignes de `tracking_events_log` antérieures au déploiement v2 du
 * pipeline attribution.
 *
 * Référence : `docs/attribution-fix-2026-05/`.
 *
 * Différence vs v1 (`backfill-traffic-source.ts`) :
 *  - v1 lit `payload.referrer + payload.utm_*` — qui sont VIDES en prod
 *    (cause #3 de l'audit) → no-op pour la majorité des events.
 *  - v2 lit `visitor_attribution` (JOIN par `anonymous_id`) — la table
 *    EST remplie en prod car `AttributionCaptureBridge` POST-trackait
 *    déjà /api/track/attribution avant le déploiement events-log fix.
 *
 * Stratégie :
 *  1. Itérer par batch de 5000 events avec `traffic_source IS NULL`.
 *  2. Pour chaque visitor unique, charger `visitor_attribution`.
 *  3. Apply `last_paid_touch` strategy → bucket via taxonomy.
 *  4. UPDATE le batch d'events de ce visitor avec le bucket résolu.
 *  5. Idempotent : ne touche jamais une row avec `traffic_source` non-NULL.
 *
 * Usage :
 *   pnpm tsx scripts/backfill-traffic-source-v2.ts --dry-run
 *   pnpm tsx scripts/backfill-traffic-source-v2.ts --from 2026-01-01
 *   pnpm tsx scripts/backfill-traffic-source-v2.ts --batch 10000
 */
import './_load-env.mjs';
import { and, eq, gte, lte, isNull, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { trackingEventsLog } from '@/lib/db/schema';
import { findAttributionByVisitor } from '@/lib/tracking/attribution/repository';
import { applyStrategy } from '@/lib/tracking/attribution/strategy';
import {
  bucketFromAttributionChannel,
  type TrafficBucket,
} from '@/lib/tracking/taxonomy';

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
    else if (a === '--from') opts.from = new Date(argv[++i]!);
    else if (a === '--to') opts.to = new Date(argv[++i]!);
    else if (a === '--batch') opts.batchSize = Math.max(100, parseInt(argv[++i]!, 10));
  }
  return opts;
}

interface BackfillStats {
  processed: number;
  updated: number;
  skippedNoAttribution: number;
  buckets: Record<string, number>;
}

async function resolveBucketForVisitor(
  anonymousId: string,
): Promise<{ bucket: TrafficBucket; medium: string } | null> {
  const stored = await findAttributionByVisitor(anonymousId);
  if (!stored) return null;
  const touch = applyStrategy(stored, 'last_paid_touch');
  if (touch.channel === 'direct' && !touch.utm) return null;
  const bucket = bucketFromAttributionChannel(touch.channel, touch.is_paid);
  return {
    bucket,
    medium: touch.utm?.medium ?? (touch.is_paid ? 'cpc' : 'organic'),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const handle = db();
  if (!handle) {
    console.error('❌ Aucune connexion DATABASE_URL — abort.');
    process.exit(1);
  }

  console.log(
    '🔄 Backfill traffic_source v2',
    args.dryRun ? '(DRY RUN)' : '',
    `batch=${args.batchSize}`,
  );

  const stats: BackfillStats = {
    processed: 0,
    updated: 0,
    skippedNoAttribution: 0,
    buckets: {},
  };

  const dateConditions = [];
  if (args.from) dateConditions.push(gte(trackingEventsLog.receivedAt, args.from));
  if (args.to) dateConditions.push(lte(trackingEventsLog.receivedAt, args.to));

  // Boucle par batch jusqu'à épuisement des events NULL
  let iteration = 0;
  while (true) {
    iteration += 1;
    const whereClause = and(
      isNull(trackingEventsLog.trafficSource),
      ...dateConditions,
    );

    const rows = await handle
      .select({
        id: trackingEventsLog.id,
        anonymousId: trackingEventsLog.anonymousId,
      })
      .from(trackingEventsLog)
      .where(whereClause)
      .limit(args.batchSize);

    if (rows.length === 0) {
      console.log(`✅ Plus aucune row à backfill (iter ${iteration}).`);
      break;
    }

    console.log(`📦 Batch ${iteration} : ${rows.length} events à traiter...`);

    // Grouper par anonymousId pour minimiser les lectures attribution
    const byVisitor = new Map<string, string[]>(); // anonymousId → eventIds
    for (const r of rows) {
      const arr = byVisitor.get(r.anonymousId) ?? [];
      arr.push(r.id);
      byVisitor.set(r.anonymousId, arr);
    }

    for (const [visitorId, eventIds] of byVisitor.entries()) {
      stats.processed += eventIds.length;
      const resolved = await resolveBucketForVisitor(visitorId);
      if (!resolved) {
        stats.skippedNoAttribution += eventIds.length;
        continue;
      }

      stats.buckets[resolved.bucket] = (stats.buckets[resolved.bucket] ?? 0) + eventIds.length;

      if (args.dryRun) continue;

      // UPDATE atomique du batch d'events de ce visiteur.
      // Garde-fou : `traffic_source IS NULL` empêche d'écraser une row
      // déjà backfilée (idempotence absolue).
      await handle
        .update(trackingEventsLog)
        .set({
          trafficSource: resolved.bucket,
          trafficMedium: resolved.medium,
        })
        .where(
          and(
            eq(trackingEventsLog.anonymousId, visitorId),
            isNull(trackingEventsLog.trafficSource),
          ),
        );

      stats.updated += eventIds.length;
    }

    console.log(
      `   → processed: ${stats.processed}, updated: ${stats.updated}, skipped(no_attr): ${stats.skippedNoAttribution}`,
    );

    if (rows.length < args.batchSize) {
      console.log('✅ Dernier batch traité.');
      break;
    }
  }

  console.log('\n📊 Résultat final :');
  console.log(`  Events processed        : ${stats.processed}`);
  console.log(`  Events updated          : ${stats.updated} ${args.dryRun ? '(dry-run)' : ''}`);
  console.log(`  Skipped (no attribution): ${stats.skippedNoAttribution}`);
  console.log(`  Buckets distribution    :`);
  for (const [bucket, count] of Object.entries(stats.buckets).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${bucket.padEnd(20)} : ${count}`);
  }

  if (args.dryRun) {
    console.log('\n💡 Re-run sans --dry-run pour appliquer les UPDATEs.');
  }
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
