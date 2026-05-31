/**
 * Read-side queries for the /admin/emails UI.
 *
 * RSC-only ('server-only' enforced via the lib client). The /api/admin/emails
 * endpoints (if any) reuse these functions.
 */
import 'server-only';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailOutbox, emailEvent, type EmailOutboxRow } from '@/lib/db/schema-emails';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

export type OutboxListItem = Pick<
  EmailOutboxRow,
  | 'id'
  | 'template'
  | 'toEmail'
  | 'toName'
  | 'subject'
  | 'status'
  | 'attempts'
  | 'maxAttempts'
  | 'smtpMessageId'
  | 'lastError'
  | 'source'
  | 'createdAt'
  | 'deliveredAt'
>;

export type OutboxKpi = {
  totalLast7d: number;
  sentLast7d: number;
  deliveredLast7d: number;
  failedLast7d: number;
  dlqLast7d: number;
  pendingNow: number;
};

export async function listRecentOutbox(opts: { limit?: number; status?: string } = {}): Promise<OutboxListItem[]> {
  const drizzle = requireDb();
  const limit = Math.min(opts.limit ?? 100, 500);
  const where = opts.status
    ? eq(emailOutbox.status, opts.status as EmailOutboxRow['status'])
    : undefined;
  const rows = await drizzle
    .select({
      id: emailOutbox.id,
      template: emailOutbox.template,
      toEmail: emailOutbox.toEmail,
      toName: emailOutbox.toName,
      subject: emailOutbox.subject,
      status: emailOutbox.status,
      attempts: emailOutbox.attempts,
      maxAttempts: emailOutbox.maxAttempts,
      smtpMessageId: emailOutbox.smtpMessageId,
      lastError: emailOutbox.lastError,
      source: emailOutbox.source,
      createdAt: emailOutbox.createdAt,
      deliveredAt: emailOutbox.deliveredAt,
    })
    .from(emailOutbox)
    .where(where as Parameters<typeof drizzle.select>[0] extends never ? never : ReturnType<typeof and>)
    .orderBy(desc(emailOutbox.createdAt))
    .limit(limit);
  return rows as OutboxListItem[];
}

export async function getOutboxRow(id: string): Promise<EmailOutboxRow | null> {
  const drizzle = requireDb();
  const rows = await drizzle
    .select()
    .from(emailOutbox)
    .where(eq(emailOutbox.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getOutboxTimeline(id: string) {
  const drizzle = requireDb();
  return drizzle
    .select()
    .from(emailEvent)
    .where(eq(emailEvent.outboxId, id))
    .orderBy(desc(emailEvent.ts));
}

export async function getOutboxKpi(): Promise<OutboxKpi> {
  const drizzle = requireDb();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [agg] = await drizzle
    .select({
      total: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) FILTER (WHERE ${emailOutbox.status} IN ('sent','delivered','opened','clicked'))::int`,
      delivered: sql<number>`count(*) FILTER (WHERE ${emailOutbox.status} IN ('delivered','opened','clicked'))::int`,
      failed: sql<number>`count(*) FILTER (WHERE ${emailOutbox.status} IN ('failed','bounced_soft','bounced_permanent'))::int`,
      dlq: sql<number>`count(*) FILTER (WHERE ${emailOutbox.status} = 'dlq')::int`,
    })
    .from(emailOutbox)
    .where(gte(emailOutbox.createdAt, sevenDaysAgo));

  const [pending] = await drizzle
    .select({ n: sql<number>`count(*)::int` })
    .from(emailOutbox)
    .where(eq(emailOutbox.status, 'pending'));

  return {
    totalLast7d: agg?.total ?? 0,
    sentLast7d: agg?.sent ?? 0,
    deliveredLast7d: agg?.delivered ?? 0,
    failedLast7d: agg?.failed ?? 0,
    dlqLast7d: agg?.dlq ?? 0,
    pendingNow: pending?.n ?? 0,
  };
}
