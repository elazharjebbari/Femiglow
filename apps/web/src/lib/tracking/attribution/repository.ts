/**
 * Repository attribution — persistance cross-session.
 *
 * Source de vérité serveur (cookie côté client = fast path, DB =
 * canonical). Sert au debugger admin, à la résolution server-side pour
 * les CAPI futures, et au backup en cas de purge cookie (ITP Safari 7j).
 *
 * Mode in-memory (memoryStore) + mode DB (Drizzle). Code commun via le
 * helper `db()` qui renvoie null en mode sans DB.
 */
import 'server-only';
import { and, eq, lt } from 'drizzle-orm';
import { db as getDb, memoryStore, schema } from '@/lib/db/client';
import type { VisitorAttributionRow } from '@/lib/db/types';
import {
  channelTouchSchema,
  type AttributionSnapshot,
  type ChannelTouch,
} from './types';

const MAX_PAID_HISTORY = 20;

/** Charge le snapshot d'un visiteur. Renvoie null si inconnu. */
export async function findAttributionByVisitor(
  visitorId: string,
): Promise<AttributionSnapshot | null> {
  const drizzle = getDb();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.visitorAttribution)
      .where(eq(schema.visitorAttribution.visitorId, visitorId))
      .limit(1);
    const row = rows[0];
    return row ? rowToSnapshot(row) : null;
  }
  const mem = memoryStore().visitorAttribution.get(visitorId);
  return mem ? rowToSnapshot(mem as VisitorAttributionRow) : null;
}

/**
 * Upsert idempotent : insert si visitor inconnu (first_touch =
 * last_touch = touch), update sinon (first_touch préservé, last_touch
 * refresh, paid_history prepend+dedup+LRU).
 *
 * Renvoie le snapshot final pour permettre au caller de répondre avec
 * l'état appliqué (pratique pour le debugger).
 */
export async function upsertAttribution(input: {
  visitorId: string;
  touch: ChannelTouch;
}): Promise<AttributionSnapshot> {
  const { visitorId } = input;
  // Validation paranoïaque : on rejette un touch malformé avant
  // d'écrire en BDD (le payload peut venir d'un client malveillant).
  const touch = channelTouchSchema.parse(input.touch);

  const now = new Date();
  const current = await findAttributionByVisitor(visitorId);
  const next = mergeServerTouch(current, touch);

  const drizzle = getDb();
  if (drizzle) {
    if (current) {
      await drizzle
        .update(schema.visitorAttribution)
        .set({
          lastTouch: next.last_touch as never,
          paidHistory: next.paid_history as never,
          updatedAt: now,
        })
        .where(eq(schema.visitorAttribution.visitorId, visitorId));
    } else {
      await drizzle.insert(schema.visitorAttribution).values({
        visitorId,
        firstTouch: next.first_touch as never,
        lastTouch: next.last_touch as never,
        paidHistory: next.paid_history as never,
        createdAt: now,
        updatedAt: now,
      });
    }
  } else {
    const existingMem = memoryStore().visitorAttribution.get(visitorId);
    memoryStore().visitorAttribution.set(visitorId, {
      visitorId,
      firstTouch: next.first_touch as unknown as Record<string, unknown>,
      lastTouch: next.last_touch as unknown as Record<string, unknown>,
      paidHistory: next.paid_history as unknown as Record<string, unknown>[],
      createdAt: existingMem?.createdAt ?? now,
      updatedAt: now,
    });
  }
  return next;
}

/**
 * Cron de purge : supprime les snapshots inactifs depuis > 90j.
 * Renvoie le nombre de lignes supprimées.
 */
export async function purgeOldAttributions(olderThanDays = 90): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const drizzle = getDb();
  if (drizzle) {
    const res = await drizzle
      .delete(schema.visitorAttribution)
      .where(lt(schema.visitorAttribution.updatedAt, cutoff))
      .returning();
    return res.length;
  }
  let count = 0;
  const store = memoryStore().visitorAttribution;
  for (const [id, row] of store.entries()) {
    if (row.updatedAt < cutoff) {
      store.delete(id);
      count += 1;
    }
  }
  return count;
}

/* ─── helpers internes ────────────────────────────────────────── */

function rowToSnapshot(row: VisitorAttributionRow): AttributionSnapshot {
  return {
    first_touch: row.firstTouch as unknown as ChannelTouch | null,
    last_touch: row.lastTouch as unknown as ChannelTouch | null,
    paid_history: (row.paidHistory ?? []) as unknown as ChannelTouch[],
  };
}

/**
 * Merge serveur. Logique identique au `mergeTouch` client mais sans
 * dépendance navigateur (réutilisable en server actions).
 */
function mergeServerTouch(
  current: AttributionSnapshot | null,
  touch: ChannelTouch,
): AttributionSnapshot {
  const first_touch = current?.first_touch ?? touch;
  const last_touch = touch;
  let paid_history = current?.paid_history ?? [];
  if (touch.is_paid) {
    paid_history = [
      touch,
      ...paid_history.filter(
        (t) => !(t.click_id && touch.click_id && t.click_id === touch.click_id),
      ),
    ].slice(0, MAX_PAID_HISTORY);
  }
  return { first_touch, last_touch, paid_history };
}

/** Exporté pour les tests + appels server actions. */
export const __test__ = { mergeServerTouch };
