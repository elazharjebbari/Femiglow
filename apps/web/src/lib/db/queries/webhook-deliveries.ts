import { and, desc, eq, lte, sql as dsql } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { DeliveryStatus, WebhookDelivery, WebhookEventName } from '@/lib/db/types';

function rowToDelivery(row: typeof schema.webhookDeliveries.$inferSelect): WebhookDelivery {
  return {
    ...row,
    event: row.event as WebhookEventName,
    payload: (row.payload ?? {}) as Record<string, unknown>,
  };
}

export async function listDeliveries(input: {
  endpointId?: string;
  status?: DeliveryStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: WebhookDelivery[]; total: number }> {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 50;
  const drizzle = db();
  if (drizzle) {
    const conditions: ReturnType<typeof eq>[] = [];
    if (input.endpointId) conditions.push(eq(schema.webhookDeliveries.endpointId, input.endpointId));
    if (input.status) conditions.push(eq(schema.webhookDeliveries.status, input.status));
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, totalRows] = await Promise.all([
      drizzle
        .select()
        .from(schema.webhookDeliveries)
        .where(where)
        .orderBy(desc(schema.webhookDeliveries.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      drizzle
        .select({ c: dsql<number>`count(*)::int` })
        .from(schema.webhookDeliveries)
        .where(where),
    ]);
    return { rows: rows.map(rowToDelivery), total: totalRows[0]?.c ?? 0 };
  }
  const store = memoryStore();
  let rows = Array.from(store.webhookDeliveries.values()).filter((d) => {
    if (input.endpointId && d.endpointId !== input.endpointId) return false;
    if (input.status && d.status !== input.status) return false;
    return true;
  });
  rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const total = rows.length;
  rows = rows.slice((page - 1) * pageSize, page * pageSize);
  return { rows, total };
}

export async function getDelivery(id: string): Promise<WebhookDelivery | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.webhookDeliveries)
      .where(eq(schema.webhookDeliveries.id, id))
      .limit(1);
    return rows[0] ? rowToDelivery(rows[0]) : null;
  }
  return memoryStore().webhookDeliveries.get(id) ?? null;
}

export async function createDelivery(input: {
  endpointId: string;
  event: WebhookEventName;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<WebhookDelivery> {
  const drizzle = db();
  if (drizzle) {
    const existing = await drizzle
      .select()
      .from(schema.webhookDeliveries)
      .where(
        and(
          eq(schema.webhookDeliveries.endpointId, input.endpointId),
          eq(schema.webhookDeliveries.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing[0]) return rowToDelivery(existing[0]);
    const now = new Date();
    const delivery: WebhookDelivery = {
      id: createId('wd'),
      endpointId: input.endpointId,
      event: input.event,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      status: 'pending',
      attemptCount: 0,
      nextAttemptAt: now,
      responseStatus: null,
      responseBody: null,
      errorCode: null,
      latencyMs: null,
      createdAt: now,
      updatedAt: now,
    };
    await drizzle.insert(schema.webhookDeliveries).values(delivery);
    return delivery;
  }
  const store = memoryStore();
  for (const d of store.webhookDeliveries.values()) {
    if (d.idempotencyKey === input.idempotencyKey) return d;
  }
  const now = new Date();
  const delivery: WebhookDelivery = {
    id: createId('wd'),
    endpointId: input.endpointId,
    event: input.event,
    payload: input.payload,
    idempotencyKey: input.idempotencyKey,
    status: 'pending',
    attemptCount: 0,
    nextAttemptAt: now,
    responseStatus: null,
    responseBody: null,
    errorCode: null,
    latencyMs: null,
    createdAt: now,
    updatedAt: now,
  };
  store.webhookDeliveries.set(delivery.id, delivery);
  return delivery;
}

export async function claimPending(limit: number, now: Date): Promise<WebhookDelivery[]> {
  const drizzle = db();
  if (drizzle) {
    const candidates = await drizzle
      .select({ id: schema.webhookDeliveries.id })
      .from(schema.webhookDeliveries)
      .where(
        and(
          eq(schema.webhookDeliveries.status, 'pending'),
          lte(schema.webhookDeliveries.nextAttemptAt, now),
        ),
      )
      .limit(limit);
    if (candidates.length === 0) return [];
    const ids = candidates.map((c) => c.id);
    const rows = await drizzle
      .update(schema.webhookDeliveries)
      .set({ status: 'in_progress', updatedAt: new Date() })
      .where(
        and(
          eq(schema.webhookDeliveries.status, 'pending'),
          dsql`${schema.webhookDeliveries.id} in ${ids}`,
        ),
      )
      .returning();
    return rows.map(rowToDelivery);
  }
  const store = memoryStore();
  const claimed: WebhookDelivery[] = [];
  for (const d of store.webhookDeliveries.values()) {
    if (claimed.length >= limit) break;
    if (d.status !== 'pending') continue;
    if (!d.nextAttemptAt || d.nextAttemptAt > now) continue;
    const next: WebhookDelivery = { ...d, status: 'in_progress', updatedAt: new Date() };
    store.webhookDeliveries.set(d.id, next);
    claimed.push(next);
  }
  return claimed;
}

export async function recordDeliveryAttempt(input: {
  id: string;
  status: DeliveryStatus;
  responseStatus?: number | null;
  responseBody?: string | null;
  errorCode?: string | null;
  latencyMs?: number | null;
  nextAttemptAt?: Date | null;
}): Promise<WebhookDelivery> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .update(schema.webhookDeliveries)
      .set({
        status: input.status,
        attemptCount: dsql`${schema.webhookDeliveries.attemptCount} + 1`,
        responseStatus: input.responseStatus ?? null,
        responseBody: input.responseBody ?? null,
        errorCode: input.errorCode ?? null,
        latencyMs: input.latencyMs ?? null,
        nextAttemptAt: input.nextAttemptAt ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.webhookDeliveries.id, input.id))
      .returning();
    if (!rows[0]) throw new Error(`Delivery ${input.id} introuvable`);
    return rowToDelivery(rows[0]);
  }
  const store = memoryStore();
  const current = store.webhookDeliveries.get(input.id);
  if (!current) throw new Error(`Delivery ${input.id} introuvable`);
  const next: WebhookDelivery = {
    ...current,
    status: input.status,
    attemptCount: current.attemptCount + 1,
    responseStatus: input.responseStatus ?? null,
    responseBody: input.responseBody ?? null,
    errorCode: input.errorCode ?? null,
    latencyMs: input.latencyMs ?? null,
    nextAttemptAt: input.nextAttemptAt ?? null,
    updatedAt: new Date(),
  };
  store.webhookDeliveries.set(input.id, next);
  return next;
}
