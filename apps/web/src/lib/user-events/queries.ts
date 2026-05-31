/**
 * Read queries pour le dashboard debug user_event (M5.2.7).
 */
import 'server-only';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { userEvent, type UserEventRow } from '@/lib/db/schema';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

export type EventCountByName = { eventName: string; count: number; source: string };
export type RecentEvent = Pick<
  UserEventRow,
  'id' | 'email' | 'eventName' | 'ts' | 'source' | 'sessionId' | 'leadId'
> & { properties: Record<string, unknown> };

/**
 * Compte les events par (event_name, source) sur les dernières 24h.
 */
export async function getEventCountsByName(
  windowMs: number = 24 * 3600_000,
): Promise<EventCountByName[]> {
  const drizzle = requireDb();
  const since = new Date(Date.now() - windowMs);
  const rows = await drizzle
    .select({
      eventName: userEvent.eventName,
      source: userEvent.source,
      count: sql<number>`count(*)::int`,
    })
    .from(userEvent)
    .where(gte(userEvent.ts, since))
    .groupBy(userEvent.eventName, userEvent.source)
    .orderBy(desc(sql<number>`count(*)`));

  return rows.map((r) => ({
    eventName: r.eventName,
    source: r.source,
    count: r.count,
  }));
}

/**
 * Récupère les N derniers events, optionnellement filtré par source.
 */
export async function getRecentEvents(opts: {
  limit?: number;
  source?: 'web' | 'server' | 'email' | 'admin' | 'import';
} = {}): Promise<RecentEvent[]> {
  const drizzle = requireDb();
  const limit = Math.min(Math.max(1, opts.limit ?? 100), 500);
  const where = opts.source ? eq(userEvent.source, opts.source) : undefined;

  const rows = await drizzle
    .select({
      id: userEvent.id,
      email: userEvent.email,
      eventName: userEvent.eventName,
      ts: userEvent.ts,
      source: userEvent.source,
      sessionId: userEvent.sessionId,
      leadId: userEvent.leadId,
      properties: userEvent.properties,
    })
    .from(userEvent)
    .where(where as ReturnType<typeof and>)
    .orderBy(desc(userEvent.ts))
    .limit(limit);

  return rows as RecentEvent[];
}

/**
 * Total events sur fenêtre donnée — pour KPI rapide.
 */
export async function getTotalEvents(windowMs: number = 24 * 3600_000): Promise<number> {
  const drizzle = requireDb();
  const since = new Date(Date.now() - windowMs);
  const [row] = await drizzle
    .select({ n: sql<number>`count(*)::int` })
    .from(userEvent)
    .where(gte(userEvent.ts, since));
  return row?.n ?? 0;
}
