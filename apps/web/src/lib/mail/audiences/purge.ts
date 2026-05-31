/**
 * Purge snapshots expirés (M5.3.10).
 *
 * Supprime les snapshots dont `purgeable_after < now()`. Les membres
 * sont supprimés en cascade par la FK. À utiliser via cron quotidien.
 *
 * Future-proof : quand M5.4 sera mergé, on cleanup aussi les listes
 * Listmonk éphémères (vhost dédié).
 */
import 'server-only';
import { lt, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailAudienceSnapshot } from '@/lib/db/schema-emails';
import { logger } from '@/lib/logging/logger';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

export type PurgeResult = {
  purged: number;
  durationMs: number;
};

export async function purgeExpiredSnapshots(): Promise<PurgeResult> {
  const drizzle = requireDb();
  const start = Date.now();

  // Compte d'abord pour le log (DELETE returning n'est pas universellement
  // supporté en drizzle ; on fait COUNT + DELETE).
  const [{ n } = { n: 0 }] = await drizzle
    .select({ n: sql<number>`count(*)::int` })
    .from(emailAudienceSnapshot)
    .where(lt(emailAudienceSnapshot.purgeableAfter, sql`now()`));

  if (n > 0) {
    await drizzle
      .delete(emailAudienceSnapshot)
      .where(lt(emailAudienceSnapshot.purgeableAfter, sql`now()`));
  }

  const durationMs = Date.now() - start;
  logger.info('audience.snapshot.purged', { count: n, durationMs });
  return { purged: n, durationMs };
}
