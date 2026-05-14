import { and, desc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import type {
  TrackingEventCategory,
  TrackingEventLogEntry,
  TrackingProviderResult,
  TrackingConsentState,
} from '@/lib/db/types';

const MAX_MEMORY_LOG = 5000;

export interface LogEventInput {
  id: string;
  eventId: string;
  eventName: string;
  eventCategory: TrackingEventCategory;
  pageId?: string | null;
  componentId?: string | null;
  pageRoute: string;
  anonymousId: string;
  sessionId: string;
  userId?: string | null;
  consentSnapshot: TrackingConsentState;
  payload: Record<string, unknown>;
  uaHash: string;
  ipAnonymized: string;
  device: 'mobile' | 'tablet' | 'desktop';
  locale: string;
  isConversion?: boolean;
  providersDispatched?: string[];
  providersResults?: Record<string, TrackingProviderResult>;
  receivedAt?: Date;
  schemaVersion?: number;
}

export interface ListEventsOptions {
  eventName?: string;
  pageRoute?: string;
  anonymousId?: string;
  sessionId?: string;
  isConversion?: boolean;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

function rowToEntry(row: typeof schema.trackingEventsLog.$inferSelect): TrackingEventLogEntry {
  return {
    id: row.id,
    eventId: row.eventId,
    eventName: row.eventName,
    eventCategory: row.eventCategory as TrackingEventCategory,
    pageId: row.pageId,
    componentId: row.componentId,
    pageRoute: row.pageRoute,
    anonymousId: row.anonymousId,
    sessionId: row.sessionId,
    userId: row.userId,
    consentSnapshot: row.consentSnapshot as TrackingConsentState,
    payload: (row.payload as Record<string, unknown>) ?? {},
    uaHash: row.uaHash,
    ipAnonymized: row.ipAnonymized,
    device: row.device as 'mobile' | 'tablet' | 'desktop',
    locale: row.locale,
    isConversion: row.isConversion,
    providersDispatched: (row.providersDispatched as string[]) ?? [],
    providersResults: (row.providersResults as Record<string, TrackingProviderResult>) ?? {},
    receivedAt: row.receivedAt,
    schemaVersion: row.schemaVersion,
  };
}

export async function logEvent(input: LogEventInput): Promise<TrackingEventLogEntry> {
  const now = input.receivedAt ?? new Date();
  const entry: TrackingEventLogEntry = {
    id: input.id,
    eventId: input.eventId,
    eventName: input.eventName,
    eventCategory: input.eventCategory,
    pageId: input.pageId ?? null,
    componentId: input.componentId ?? null,
    pageRoute: input.pageRoute,
    anonymousId: input.anonymousId,
    sessionId: input.sessionId,
    userId: input.userId ?? null,
    consentSnapshot: input.consentSnapshot,
    payload: input.payload,
    uaHash: input.uaHash,
    ipAnonymized: input.ipAnonymized,
    device: input.device,
    locale: input.locale,
    isConversion: input.isConversion ?? false,
    providersDispatched: input.providersDispatched ?? [],
    providersResults: input.providersResults ?? {},
    receivedAt: now,
    schemaVersion: input.schemaVersion ?? 1,
  };
  const drizzle = db();
  if (drizzle) {
    try {
      await drizzle.insert(schema.trackingEventsLog).values({
        id: entry.id,
        eventId: entry.eventId,
        eventName: entry.eventName,
        eventCategory: entry.eventCategory,
        pageId: entry.pageId,
        componentId: entry.componentId,
        pageRoute: entry.pageRoute,
        anonymousId: entry.anonymousId,
        sessionId: entry.sessionId,
        userId: entry.userId,
        consentSnapshot: entry.consentSnapshot,
        payload: entry.payload,
        uaHash: entry.uaHash,
        ipAnonymized: entry.ipAnonymized,
        device: entry.device,
        locale: entry.locale,
        isConversion: entry.isConversion,
        providersDispatched: entry.providersDispatched,
        providersResults: entry.providersResults,
        receivedAt: entry.receivedAt,
        schemaVersion: entry.schemaVersion,
      } as typeof schema.trackingEventsLog.$inferInsert);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('duplicate') && !message.includes('unique')) throw err;
    }
  } else {
    const store = memoryStore();
    if (store.trackingEventsLog.has(entry.id)) return entry;
    store.trackingEventsLog.set(entry.id, entry);
    store.trackingEventsLogOrder.push(entry.id);
    while (store.trackingEventsLogOrder.length > MAX_MEMORY_LOG) {
      const oldest = store.trackingEventsLogOrder.shift();
      if (oldest) store.trackingEventsLog.delete(oldest);
    }
  }
  return entry;
}

export async function findEventByEventId(eventId: string): Promise<TrackingEventLogEntry | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.trackingEventsLog)
      .where(eq(schema.trackingEventsLog.eventId, eventId))
      .limit(1);
    return rows[0] ? rowToEntry(rows[0]) : null;
  }
  for (const e of memoryStore().trackingEventsLog.values()) {
    if (e.eventId === eventId) return e;
  }
  return null;
}

export async function listEvents(opts: ListEventsOptions = {}): Promise<TrackingEventLogEntry[]> {
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  const drizzle = db();
  if (drizzle) {
    const conditions = [] as Parameters<typeof and>;
    if (opts.eventName) conditions.push(eq(schema.trackingEventsLog.eventName, opts.eventName));
    if (opts.pageRoute) conditions.push(eq(schema.trackingEventsLog.pageRoute, opts.pageRoute));
    if (opts.anonymousId)
      conditions.push(eq(schema.trackingEventsLog.anonymousId, opts.anonymousId));
    if (opts.sessionId) conditions.push(eq(schema.trackingEventsLog.sessionId, opts.sessionId));
    if (opts.isConversion !== undefined)
      conditions.push(eq(schema.trackingEventsLog.isConversion, opts.isConversion));
    if (opts.fromDate) conditions.push(gte(schema.trackingEventsLog.receivedAt, opts.fromDate));
    if (opts.toDate) conditions.push(lte(schema.trackingEventsLog.receivedAt, opts.toDate));
    const where = conditions.length ? and(...conditions) : undefined;
    const baseQuery = drizzle.select().from(schema.trackingEventsLog);
    const rows = where
      ? await baseQuery
          .where(where)
          .orderBy(desc(schema.trackingEventsLog.receivedAt))
          .limit(limit)
          .offset(offset)
      : await baseQuery
          .orderBy(desc(schema.trackingEventsLog.receivedAt))
          .limit(limit)
          .offset(offset);
    return rows.map(rowToEntry);
  }
  let entries = Array.from(memoryStore().trackingEventsLog.values());
  if (opts.eventName) entries = entries.filter((e) => e.eventName === opts.eventName);
  if (opts.pageRoute) entries = entries.filter((e) => e.pageRoute === opts.pageRoute);
  if (opts.anonymousId) entries = entries.filter((e) => e.anonymousId === opts.anonymousId);
  if (opts.sessionId) entries = entries.filter((e) => e.sessionId === opts.sessionId);
  if (opts.isConversion !== undefined)
    entries = entries.filter((e) => e.isConversion === opts.isConversion);
  if (opts.fromDate) entries = entries.filter((e) => e.receivedAt >= opts.fromDate!);
  if (opts.toDate) entries = entries.filter((e) => e.receivedAt <= opts.toDate!);
  entries.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
  return entries.slice(offset, offset + limit);
}

export async function purgeEventsBefore(date: Date): Promise<number> {
  const drizzle = db();
  if (drizzle) {
    // Use lt() so Drizzle infers the column type (timestamptz) and binds the
    // Date param correctly. The raw sql`${col} < ${date}` form lost the type
    // info and produced "Failed query: ..." on postgres-js driver.
    const result = await drizzle
      .delete(schema.trackingEventsLog)
      .where(lt(schema.trackingEventsLog.receivedAt, date));
    // postgres-js returns `{ count: number }`, Neon returns `{ rowCount: number }`.
    const r = result as { rowCount?: number; count?: number };
    return Number(r.rowCount ?? r.count ?? 0);
  }
  const store = memoryStore();
  let count = 0;
  for (const [id, e] of store.trackingEventsLog.entries()) {
    if (e.receivedAt < date) {
      store.trackingEventsLog.delete(id);
      count += 1;
    }
  }
  store.trackingEventsLogOrder = store.trackingEventsLogOrder.filter((id) =>
    store.trackingEventsLog.has(id),
  );
  return count;
}

export async function countEventsSince(date: Date): Promise<number> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select({ count: sql<number>`count(*)` })
      .from(schema.trackingEventsLog)
      .where(gte(schema.trackingEventsLog.receivedAt, date));
    return Number(rows[0]?.count ?? 0);
  }
  let count = 0;
  for (const e of memoryStore().trackingEventsLog.values()) {
    if (e.receivedAt >= date) count += 1;
  }
  return count;
}
