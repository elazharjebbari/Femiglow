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
import { and, isNull, lt, sql } from 'drizzle-orm';
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

/**
 * Critère de purge GARDÉ (L-LEAK) : une snapshot n'est purgeable que si elle
 * est expirée ET déjà DÉLIÉE de toute liste Listmonk (`listmonk_list_id IS
 * NULL`). Sans cette garde, la purge supprimerait une snapshot encore liée
 * AVANT que le cleanup (`cleanupExpiredListmonkLists`) n'ait supprimé la liste
 * distante — on perdrait le `listmonk_list_id` et la liste fuiterait côté
 * Listmonk. L'ordre attendu est donc : cleanup d'abord (NULLifie le listId),
 * purge ensuite (ne voit que les snapshots déliées). Cf. README module 10 §2.3.
 */
function purgeableWhere() {
  return and(
    lt(emailAudienceSnapshot.purgeableAfter, sql`now()`),
    isNull(emailAudienceSnapshot.listmonkListId),
  );
}

export async function purgeExpiredSnapshots(): Promise<PurgeResult> {
  const drizzle = requireDb();
  const start = Date.now();

  // Compte d'abord pour le log (DELETE returning n'est pas universellement
  // supporté en drizzle ; on fait COUNT + DELETE).
  const [{ n } = { n: 0 }] = await drizzle
    .select({ n: sql<number>`count(*)::int` })
    .from(emailAudienceSnapshot)
    .where(purgeableWhere());

  if (n > 0) {
    await drizzle.delete(emailAudienceSnapshot).where(purgeableWhere());
  }

  const durationMs = Date.now() - start;
  logger.info('audience.snapshot.purged', { count: n, durationMs });
  return { purged: n, durationMs };
}
