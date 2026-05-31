/**
 * CHA-230 — Repository idempotence checkout.
 *
 * Garantit qu'une requête PATCH/POST avec une même `Idempotency-Key`
 * dans une `scope` donnée renverra exactement la même réponse pendant
 * 24h. Permet :
 *   - de re-jouer une requête après timeout réseau (retry client) sans
 *     dupliquer la ressource côté serveur.
 *   - de détecter un changement de payload entre 2 tentatives avec la
 *     même clé → conflit 409.
 *
 * Schéma SQL : cf. drizzle/migrations/0021_checkout_idempotency.sql
 *
 * Garanties :
 *   - PK composite (key, scope) → isolation par opération.
 *   - `expires_at = now() + 24h` par défaut → purge périodique côté admin.
 *   - `request_hash` = SHA-256 hex du payload canonical JSON → comparaison
 *     déterministe entre tentatives.
 */
import { createHash } from 'node:crypto';

import { and, eq, lt } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  checkoutIdempotency,
  type CheckoutIdempotencyRow,
} from '@/lib/db/schema';

export type IdempotencyScope = CheckoutIdempotencyRow['scope'];

export class DbUnavailableError extends Error {
  constructor() {
    super('DATABASE_URL requis pour repos checkout.');
    this.name = 'DbUnavailableError';
  }
}

function requireDb(): NonNullable<ReturnType<typeof db>> {
  const conn = db();
  if (!conn) throw new DbUnavailableError();
  return conn;
}

/**
 * Hash canonical SHA-256 d'un payload. On stringify avec un ordre de clés
 * déterministe pour qu'un même payload (à clés près) donne le même hash.
 */
export function hashRequestPayload(payload: unknown): string {
  const canonical = canonicalize(payload);
  return createHash('sha256').update(canonical).digest('hex');
}

function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalize(v)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(String(value));
}

export interface IdempotencyHit {
  responseJson: unknown;
  responseStatus: number;
  resourceId: string | null;
}

export const idempotencyRepo = {
  /**
   * Cherche un hit pour la clé donnée. Retourne :
   *   - `{ match: true, ... }` si la clé existe ET le hash matche → replay.
   *   - `{ match: false, conflict: true }` si la clé existe mais hash différent → 409.
   *   - `null` si la clé est inconnue → fresh request.
   *
   * Les rows expirées sont ignorées (et seront purgées).
   */
  async lookup(
    key: string,
    scope: IdempotencyScope,
    requestHash: string,
  ): Promise<
    | { match: true; hit: IdempotencyHit }
    | { match: false; conflict: true }
    | null
  > {
    const conn = requireDb();
    const rows = await conn
      .select()
      .from(checkoutIdempotency)
      .where(and(eq(checkoutIdempotency.key, key), eq(checkoutIdempotency.scope, scope)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;
    if (row.requestHash !== requestHash) {
      return { match: false, conflict: true };
    }
    return {
      match: true,
      hit: {
        responseJson: row.responseJson,
        responseStatus: row.responseStatus,
        resourceId: row.resourceId,
      },
    };
  },

  /**
   * Enregistre la réponse à re-servir. On utilise un upsert pour traiter
   * proprement les courses concurrentes sur la même clé (chaque scope
   * étant strictement séparé).
   */
  async store(input: {
    key: string;
    scope: IdempotencyScope;
    requestHash: string;
    responseJson: unknown;
    responseStatus: number;
    resourceId?: string | null;
  }): Promise<void> {
    const conn = requireDb();
    await conn
      .insert(checkoutIdempotency)
      .values({
        key: input.key,
        scope: input.scope,
        requestHash: input.requestHash,
        responseJson: input.responseJson as Record<string, unknown>,
        responseStatus: input.responseStatus,
        resourceId: input.resourceId ?? null,
      })
      .onConflictDoUpdate({
        target: [checkoutIdempotency.key, checkoutIdempotency.scope],
        set: {
          requestHash: input.requestHash,
          responseJson: input.responseJson as Record<string, unknown>,
          responseStatus: input.responseStatus,
          resourceId: input.resourceId ?? null,
        },
      });
  },

  /** Purge les rows expirées (job cron admin). Retourne le nombre supprimé. */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const conn = requireDb();
    const deleted = await conn
      .delete(checkoutIdempotency)
      .where(lt(checkoutIdempotency.expiresAt, now))
      .returning();
    return deleted.length;
  },
};
