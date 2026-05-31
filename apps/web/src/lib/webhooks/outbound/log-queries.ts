/**
 * CHA-260 — Requêtes sur `outbound_webhook_log`.
 *
 * Mode dual-driver (cf. `lib/db/client.ts`) :
 *   - Drizzle si `DATABASE_URL` défini.
 *   - `memoryStore()` sinon (tests vitest / dev local sans Postgres).
 */
import { and, desc, eq, inArray, sql as dsql } from 'drizzle-orm';

import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { OutboundSource, OutboundStatus, OutboundWebhookLogRow } from '@/lib/db/types';

function rowToLog(row: typeof schema.outboundWebhookLog.$inferSelect): OutboundWebhookLogRow {
  return {
    ...row,
    source: row.source as OutboundSource,
    status: row.status as OutboundStatus,
    payload: (row.payload ?? {}) as Record<string, unknown>,
  };
}

export interface CreateLogInput {
  source: OutboundSource;
  sourceId: string;
  idempotencyKey: string;
  eventName: string;
  payload: Record<string, unknown>;
  status?: OutboundStatus;
}

/**
 * Insère une entrée de log. Si l'idempotency-key existe déjà → renvoie la
 * row existante (ON CONFLICT DO NOTHING …) — empêche le double envoi.
 */
export async function createOutboundLog(input: CreateLogInput): Promise<OutboundWebhookLogRow> {
  const id = createId('owl');
  const now = new Date();
  const row: OutboundWebhookLogRow = {
    id,
    source: input.source,
    sourceId: input.sourceId,
    idempotencyKey: input.idempotencyKey,
    eventName: input.eventName,
    payload: input.payload,
    status: input.status ?? 'pending',
    attemptCount: 0,
    lastError: null,
    responseStatus: null,
    latencyMs: null,
    sentAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const drizzle = db();
  if (drizzle) {
    const inserted = await drizzle
      .insert(schema.outboundWebhookLog)
      .values({
        id: row.id,
        source: row.source,
        sourceId: row.sourceId,
        idempotencyKey: row.idempotencyKey,
        eventName: row.eventName,
        payload: row.payload,
        status: row.status,
      })
      .onConflictDoNothing({ target: schema.outboundWebhookLog.idempotencyKey })
      .returning();
    if (inserted[0]) return rowToLog(inserted[0]);
    // Conflict → fetch la row existante.
    const existing = await drizzle
      .select()
      .from(schema.outboundWebhookLog)
      .where(eq(schema.outboundWebhookLog.idempotencyKey, input.idempotencyKey))
      .limit(1);
    return rowToLog(existing[0]!);
  }

  const store = memoryStore();
  for (const existing of store.outboundWebhookLog.values()) {
    if (existing.idempotencyKey === input.idempotencyKey) return existing;
  }
  store.outboundWebhookLog.set(id, row);
  return row;
}

export interface RecordAttemptInput {
  id: string;
  status: OutboundStatus;
  attemptCount: number;
  responseStatus?: number | null;
  latencyMs?: number | null;
  lastError?: string | null;
  sentAt?: Date | null;
}

export async function recordOutboundAttempt(input: RecordAttemptInput): Promise<OutboundWebhookLogRow> {
  const now = new Date();
  const patch = {
    status: input.status,
    attemptCount: input.attemptCount,
    responseStatus: input.responseStatus ?? null,
    latencyMs: input.latencyMs ?? null,
    lastError: input.lastError ?? null,
    sentAt: input.sentAt ?? null,
    updatedAt: now,
  };

  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .update(schema.outboundWebhookLog)
      .set(patch)
      .where(eq(schema.outboundWebhookLog.id, input.id))
      .returning();
    return rowToLog(rows[0]!);
  }

  const store = memoryStore();
  const existing = store.outboundWebhookLog.get(input.id);
  if (!existing) throw new Error(`outbound log ${input.id} introuvable`);
  const updated: OutboundWebhookLogRow = { ...existing, ...patch };
  store.outboundWebhookLog.set(input.id, updated);
  return updated;
}

export async function getOutboundLogByIdempotency(
  idempotencyKey: string,
): Promise<OutboundWebhookLogRow | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.outboundWebhookLog)
      .where(eq(schema.outboundWebhookLog.idempotencyKey, idempotencyKey))
      .limit(1);
    return rows[0] ? rowToLog(rows[0]) : null;
  }
  const store = memoryStore();
  for (const r of store.outboundWebhookLog.values()) {
    if (r.idempotencyKey === idempotencyKey) return r;
  }
  return null;
}

export interface ListLogsQuery {
  source?: OutboundSource;
  status?: OutboundStatus;
  limit?: number;
}

export async function listOutboundLogs(query: ListLogsQuery = {}): Promise<OutboundWebhookLogRow[]> {
  const limit = query.limit ?? 50;
  const drizzle = db();
  if (drizzle) {
    const conds: ReturnType<typeof eq>[] = [];
    if (query.source) conds.push(eq(schema.outboundWebhookLog.source, query.source));
    if (query.status) conds.push(eq(schema.outboundWebhookLog.status, query.status));
    const where = conds.length ? and(...conds) : undefined;
    const rows = await drizzle
      .select()
      .from(schema.outboundWebhookLog)
      .where(where)
      .orderBy(desc(schema.outboundWebhookLog.createdAt))
      .limit(limit);
    return rows.map(rowToLog);
  }
  const store = memoryStore();
  let rows = Array.from(store.outboundWebhookLog.values());
  if (query.source) rows = rows.filter((r) => r.source === query.source);
  if (query.status) rows = rows.filter((r) => r.status === query.status);
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return rows.slice(0, limit);
}

export async function listLatestOutboundLogsBySourceIds(
  source: OutboundSource,
  sourceIds: string[],
): Promise<Map<string, OutboundWebhookLogRow>> {
  const uniqueIds = Array.from(new Set(sourceIds.filter(Boolean)));
  const latest = new Map<string, OutboundWebhookLogRow>();
  if (uniqueIds.length === 0) return latest;

  const drizzle = db();
  const rows = drizzle
    ? (
        await drizzle
          .select()
          .from(schema.outboundWebhookLog)
          .where(
            and(
              eq(schema.outboundWebhookLog.source, source),
              inArray(schema.outboundWebhookLog.sourceId, uniqueIds),
            ),
          )
          .orderBy(desc(schema.outboundWebhookLog.createdAt))
      ).map(rowToLog)
    : Array.from(memoryStore().outboundWebhookLog.values())
        .filter((row) => row.source === source && uniqueIds.includes(row.sourceId))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  for (const row of rows) {
    if (!latest.has(row.sourceId)) latest.set(row.sourceId, row);
  }
  return latest;
}
