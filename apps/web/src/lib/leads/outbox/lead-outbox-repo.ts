/**
 * OWBS — Repository de `lead_event_outbox` (transactional outbox des effets
 * durables d'un lead). Calqué sur `lib/mail/outbox.ts`.
 *
 * - `enqueue`     : insère un effet (idempotent via UNIQUE(type,lead,dedupe)).
 * - `pickBatch`   : claim atomique d'un lot (`FOR UPDATE SKIP LOCKED`) → `processing`.
 * - `markDone`    : effet exécuté.
 * - `reschedule`  : échec → backoff (`pending`) ou `dead` après `max_attempts`.
 *
 * @see docs/checkout-leads-background-2026-06-01/00-conception/decisions/ADR-0004-lead-event-outbox.md
 */
import { and, desc, eq, sql } from 'drizzle-orm';

import { db as getDb } from '@/lib/db/client';
import { rowsOf } from '@/lib/db/exec';
import { createId } from '@/lib/ids';
import { computeBackoff } from '@/lib/mail/backoff';
import {
  leadEventOutbox,
  type LeadEventOutboxRow,
} from '@/lib/leads/db/schema-lead-outbox';

const BATCH_SIZE = 100;

export type LeadEffectType = LeadEventOutboxRow['type'];

export interface EnqueueLeadEffect {
  type: LeadEffectType;
  leadId: string;
  /** Clé d'idempotence d'effet (event_id / clé métier). */
  dedupeKey: string;
  payload?: Record<string, unknown>;
}

/** Drizzle instance compatible (core `db()` ou injectée en test). */
type AnyDb = NonNullable<ReturnType<typeof getDb>>;

function requireDb(): AnyDb {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured (DATABASE_URL missing)');
  return drizzle;
}

/** Map une row SQL brute (snake_case) vers la shape camelCase typée. */
function normalizeRow(raw: Record<string, unknown>): LeadEventOutboxRow {
  return {
    id: raw.id as string,
    type: raw.type as LeadEffectType,
    leadId: raw.lead_id as string,
    dedupeKey: raw.dedupe_key as string,
    payload: raw.payload as LeadEventOutboxRow['payload'],
    status: raw.status as LeadEventOutboxRow['status'],
    attempts: Number(raw.attempts ?? 0),
    maxAttempts: Number(raw.max_attempts ?? 8),
    nextAttemptAt: new Date(raw.next_attempt_at as string),
    lastError: (raw.last_error as string | null) ?? null,
    createdAt: new Date(raw.created_at as string),
    updatedAt: new Date(raw.updated_at as string),
  };
}

export const leadOutboxRepo = {
  /**
   * Enfile un effet. Idempotent : un doublon (type, leadId, dedupeKey) est
   * absorbé par l'index UNIQUE (no-op). À appeler dans la même transaction que
   * l'état métier (passer `tx`) pour la garantie transactional-outbox.
   */
  async enqueue(ev: EnqueueLeadEffect, tx?: AnyDb): Promise<void> {
    const drizzle = tx ?? requireDb();
    await drizzle
      .insert(leadEventOutbox)
      .values({
        id: createId('lox'),
        type: ev.type,
        leadId: ev.leadId,
        dedupeKey: ev.dedupeKey,
        payload: ev.payload ?? {},
      })
      .onConflictDoNothing({
        target: [leadEventOutbox.type, leadEventOutbox.leadId, leadEventOutbox.dedupeKey],
      });
  },

  /**
   * Claim atomique d'un lot prêt à traiter. Le `FOR UPDATE SKIP LOCKED` permet
   * à plusieurs workers cron concurrents de traiter des sous-ensembles
   * disjoints sans collision. Les rows claimées passent en `processing`.
   */
  async pickBatch(limit: number = BATCH_SIZE, _now: Date = new Date()): Promise<LeadEventOutboxRow[]> {
    const drizzle = requireDb();
    const res = (await drizzle.execute(sql`
      UPDATE lead_event_outbox o
      SET status = 'processing', updated_at = now()
      FROM (
        SELECT id
        FROM lead_event_outbox
        WHERE status = 'pending' AND next_attempt_at <= now()
        ORDER BY next_attempt_at ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      ) AS picked
      WHERE o.id = picked.id
      RETURNING o.*;
    `)) as unknown as { rows: Record<string, unknown>[] } | Record<string, unknown>[];
    return rowsOf(res).map(normalizeRow);
  },

  /** Marque un effet comme exécuté. */
  async markDone(id: string): Promise<void> {
    await requireDb()
      .update(leadEventOutbox)
      .set({ status: 'done', updatedAt: new Date() })
      .where(eq(leadEventOutbox.id, id));
  },

  /**
   * Re-planifie un effet après échec : backoff exponentiel (`pending`) ou
   * `dead` une fois `max_attempts` atteint. Retourne `{ dead }`.
   */
  async reschedule(
    row: Pick<LeadEventOutboxRow, 'id' | 'attempts' | 'maxAttempts' | 'nextAttemptAt'>,
    err: unknown,
    now: Date = new Date(),
  ): Promise<{ dead: boolean; attempts: number }> {
    const attempts = (row.attempts ?? 0) + 1;
    const dead = attempts >= (row.maxAttempts ?? 8);
    await requireDb()
      .update(leadEventOutbox)
      .set({
        status: dead ? 'dead' : 'pending',
        attempts,
        nextAttemptAt: dead ? row.nextAttemptAt : new Date(now.getTime() + computeBackoff(attempts)),
        lastError: err instanceof Error ? err.message : String(err),
        updatedAt: now,
      })
      .where(eq(leadEventOutbox.id, row.id));
    return { dead, attempts };
  },

  // ── Supervision opérateur (F11) ─────────────────────────────────────────

  /** Compteurs par statut (pour le tableau de bord admin). */
  async counts(): Promise<Record<string, number>> {
    const res = (await requireDb().execute(sql`
      SELECT status, count(*)::int AS n FROM lead_event_outbox GROUP BY status;
    `)) as unknown as { rows: { status: string; n: number }[] } | { status: string; n: number }[];
    const out: Record<string, number> = { pending: 0, processing: 0, done: 0, dead: 0 };
    for (const r of rowsOf(res)) out[String(r.status)] = Number(r.n);
    return out;
  },

  /** Liste les effets d'un statut (les plus récents d'abord). */
  async listByStatus(
    status: LeadEventOutboxRow['status'],
    limit = 50,
  ): Promise<LeadEventOutboxRow[]> {
    const rows = await requireDb()
      .select()
      .from(leadEventOutbox)
      .where(eq(leadEventOutbox.status, status))
      .orderBy(desc(leadEventOutbox.updatedAt))
      .limit(limit);
    return rows;
  },

  /**
   * Rejoue un effet `dead` : repasse `pending`, `attempts=0`, `next_attempt_at=now`.
   * Ne touche QUE les `dead` (anti-erreur). Retourne `true` si une row a été rejouée.
   */
  async replay(id: string, now: Date = new Date()): Promise<boolean> {
    const rows = await requireDb()
      .update(leadEventOutbox)
      .set({ status: 'pending', attempts: 0, nextAttemptAt: now, lastError: null, updatedAt: now })
      .where(and(eq(leadEventOutbox.id, id), eq(leadEventOutbox.status, 'dead')))
      .returning();
    return rows.length > 0;
  },
};
