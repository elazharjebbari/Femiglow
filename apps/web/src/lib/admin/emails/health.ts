/**
 * Health check for the emailing stack (M2).
 *
 * Probes that all the moving parts are functional :
 *  - DB reachable (count outbox rows last hour)
 *  - SMTP transport configured (env vars present)
 *  - Outbox not stuck (no row stuck in 'sending' > 5 min)
 *  - DLQ size acceptable (< 10 last 24h)
 *  - Last delivered timestamp (was anything ever delivered?)
 *
 * Returns a structured report consumable by the admin badge AND by external
 * monitoring (the route /api/admin/emails/health exposes this).
 */
import 'server-only';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailOutbox } from '@/lib/db/schema-emails';
import { env } from '@/lib/env';

export type HealthLevel = 'ok' | 'degraded' | 'incident';

export type HealthReport = {
  level: HealthLevel;
  checks: {
    smtpConfigured: { ok: boolean; missing?: string[] };
    db: { ok: boolean; error?: string };
    outboxStuck: { ok: boolean; stuckCount: number };
    dlq24h: { ok: boolean; count: number };
    pendingNow: number;
    lastDeliveredAt: Date | null;
  };
  timestamp: string;
};

export async function checkEmailingHealth(now: Date = new Date()): Promise<HealthReport> {
  const issues: HealthLevel[] = ['ok'];

  // 1. SMTP env config
  const missingSmtp: string[] = [];
  if (!env.SMTP_USER) missingSmtp.push('SMTP_USER');
  if (!env.SMTP_PASSWORD) missingSmtp.push('SMTP_PASSWORD');
  const smtpConfigured = { ok: missingSmtp.length === 0, missing: missingSmtp };
  if (!smtpConfigured.ok) issues.push('incident');

  // 2. DB reachable
  const drizzle = getDb();
  let dbOk = true;
  let dbError: string | undefined;
  if (!drizzle) {
    dbOk = false;
    dbError = 'Database not configured';
    issues.push('incident');
  }

  let stuckCount = 0;
  let dlqCount = 0;
  let pendingNow = 0;
  let lastDeliveredAt: Date | null = null;

  if (drizzle && dbOk) {
    try {
      // 3. Stuck in 'sending' > 5 min
      const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);
      const [stuck] = await drizzle
        .select({ n: sql<number>`count(*)::int` })
        .from(emailOutbox)
        .where(and(eq(emailOutbox.status, 'sending'), lte(emailOutbox.updatedAt, fiveMinAgo)));
      stuckCount = stuck?.n ?? 0;
      if (stuckCount > 0) issues.push('degraded');

      // 4. DLQ last 24h
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60_000);
      const [dlq] = await drizzle
        .select({ n: sql<number>`count(*)::int` })
        .from(emailOutbox)
        .where(and(eq(emailOutbox.status, 'dlq'), gte(emailOutbox.createdAt, dayAgo)));
      dlqCount = dlq?.n ?? 0;
      if (dlqCount > 10) issues.push('incident');
      else if (dlqCount > 0) issues.push('degraded');

      // 5. Pending now
      const [pending] = await drizzle
        .select({ n: sql<number>`count(*)::int` })
        .from(emailOutbox)
        .where(eq(emailOutbox.status, 'pending'));
      pendingNow = pending?.n ?? 0;
      if (pendingNow > 50) issues.push('degraded');

      // 6. Last delivered
      const [last] = await drizzle
        .select({ at: emailOutbox.deliveredAt })
        .from(emailOutbox)
        .where(eq(emailOutbox.status, 'delivered'))
        .orderBy(sql`${emailOutbox.deliveredAt} DESC NULLS LAST`)
        .limit(1);
      lastDeliveredAt = last?.at ?? null;
    } catch (err) {
      dbOk = false;
      dbError = err instanceof Error ? err.message : String(err);
      issues.push('incident');
    }
  }

  // Compute overall level (worst wins)
  const level: HealthLevel = issues.includes('incident')
    ? 'incident'
    : issues.includes('degraded')
      ? 'degraded'
      : 'ok';

  return {
    level,
    checks: {
      smtpConfigured,
      db: { ok: dbOk, error: dbError },
      outboxStuck: { ok: stuckCount === 0, stuckCount },
      dlq24h: { ok: dlqCount <= 10, count: dlqCount },
      pendingNow,
      lastDeliveredAt,
    },
    timestamp: now.toISOString(),
  };
}
