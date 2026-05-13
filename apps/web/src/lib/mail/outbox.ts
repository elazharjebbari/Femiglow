/**
 * Outbox processor — claim + attempt + retry with exponential backoff.
 *
 * Two entry points :
 *   - attemptSend(id)       : immediate single send (called from send.ts)
 *   - pickAndProcessBatch() : cron pickup (called from /api/cron/email-outbox)
 *
 * Cf. docs/emailing/03-backend-integration.md §3.4.
 */
import { and, eq, inArray, lte, or, isNull, sql } from 'drizzle-orm';

import { db as getDb } from '@/lib/db/client';
import { rowsOf } from '@/lib/db/exec';
import { emailOutbox, emailEvent, type EmailOutboxRow } from '@/lib/db/schema-emails';
import { logger } from '@/lib/logging/logger';
import { env } from '@/lib/env';
import { getTransporter, SmtpNotConfiguredError } from './client';
import { computeBackoff, MAX_ATTEMPTS } from './backoff';

const BATCH_SIZE = 100;

export type BatchResult = {
  picked: number;
  succeeded: number;
  failed: number;
  dlq: number;
  durationMs: number;
};

/**
 * Claim a single outbox row and attempt to send it via SMTP.
 * Idempotent : if the row is already `sent`/`delivered`/`dlq`, do nothing.
 */
function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured (DATABASE_URL missing)');
  return drizzle;
}

export async function attemptSend(outboxId: string): Promise<void> {
  const drizzle = requireDb();
  const claim = await drizzle
    .update(emailOutbox)
    .set({ status: 'sending', updatedAt: new Date() })
    .where(and(eq(emailOutbox.id, outboxId), inArray(emailOutbox.status, ['pending', 'failed'])))
    .returning();
  if (claim.length === 0 || !claim[0]) return; // already terminal or claimed by another worker

  const row = claim[0];
  try {
    await deliverRow(row);
  } catch (err) {
    // Reset to 'failed' so the cron will retry (and so we don't leave rows
    // stuck in 'sending' forever after a transient error).
    const nextAttempts = (row.attempts ?? 0) + 1;
    const reachedMax = nextAttempts >= MAX_ATTEMPTS;
    await drizzle
      .update(emailOutbox)
      .set({
        status: reachedMax ? 'dlq' : 'failed',
        attempts: nextAttempts,
        nextRetry: reachedMax ? null : new Date(Date.now() + computeBackoff(nextAttempts)),
        lastError: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      })
      .where(eq(emailOutbox.id, row.id));
    throw err;
  }
}

/**
 * Cron pickup : claim a batch of outbox rows ready for retry and attempt them.
 */
export async function pickAndProcessBatch(now: Date = new Date()): Promise<BatchResult> {
  const drizzle = requireDb();
  const startedAt = Date.now();

  // SELECT ... FOR UPDATE SKIP LOCKED + bulk UPDATE in a single CTE so concurrent
  // cron workers can process disjoint subsets.
  // Use Postgres now() instead of binding a JS Date — postgres-js doesn't
  // serialize raw Date objects when interpolated via sql`${date}` template.
  // Use rowsOf() to handle both Neon HTTP ({ rows: [] }) and postgres-js
  // (array direct) shapes — cf. lib/db/exec.ts.
  const result = (await drizzle.execute(sql`
    UPDATE email_outbox o
    SET status = 'sending', updated_at = now()
    FROM (
      SELECT id
      FROM email_outbox
      WHERE status IN ('pending', 'failed')
        AND (next_retry IS NULL OR next_retry <= now())
        AND attempts < max_attempts
        AND (scheduled_for IS NULL OR scheduled_for <= now())
      ORDER BY next_retry NULLS FIRST, created_at ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    ) AS picked
    WHERE o.id = picked.id
    RETURNING o.*;
  `)) as unknown as { rows: EmailOutboxRow[] } | EmailOutboxRow[];

  const list = rowsOf(result);
  let succeeded = 0;
  let failed = 0;
  let dlq = 0;

  for (const row of list) {
    try {
      await deliverRow(row);
      succeeded++;
    } catch (err) {
      const nextAttempts = (row.attempts ?? 0) + 1;
      const reachedMax = nextAttempts >= MAX_ATTEMPTS;
      await drizzle
        .update(emailOutbox)
        .set({
          status: reachedMax ? 'dlq' : 'failed',
          attempts: nextAttempts,
          nextRetry: reachedMax ? null : new Date(now.getTime() + computeBackoff(nextAttempts)),
          lastError: err instanceof Error ? err.message : String(err),
          updatedAt: new Date(),
        })
        .where(eq(emailOutbox.id, row.id));
      if (reachedMax) {
        dlq++;
        await drizzle.insert(emailEvent).values({
          outboxId: row.id,
          type: 'dlq',
          source: 'app',
          rawJson: { error: err instanceof Error ? err.message : String(err) },
        });
      } else {
        failed++;
        await drizzle.insert(emailEvent).values({
          outboxId: row.id,
          type: 'failed',
          source: 'app',
          rawJson: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  }

  return {
    picked: list.length,
    succeeded,
    failed,
    dlq,
    durationMs: Date.now() - startedAt,
  };
}

async function deliverRow(row: EmailOutboxRow): Promise<void> {
  if (!row.htmlSnapshot || !row.textSnapshot) {
    throw new Error(`Outbox ${row.id} missing rendered snapshot`);
  }

  let transporter;
  try {
    transporter = getTransporter();
  } catch (err) {
    if (err instanceof SmtpNotConfiguredError) {
      // Don't burn an attempt on a config error — surface a friendly message,
      // mark as failed so admin sees it, and skip retry path. The operator will
      // fix env and manually retry.
      const drizzle = requireDb();
      await drizzle
        .update(emailOutbox)
        .set({
          status: 'failed',
          attempts: (row.attempts ?? 0) + 1,
          lastError: err.message,
          updatedAt: new Date(),
        })
        .where(eq(emailOutbox.id, row.id));
      throw err;
    }
    throw err;
  }

  const headers: Record<string, string> = {
    'X-FG-Outbox-Id': row.id,
  };
  if (env.MAIL_UNSUB_TOKEN_SECRET) {
    // The unsubscribe URL was inlined into htmlSnapshot at send time ; here we
    // only need the header.
    headers['List-Unsubscribe'] = `<${env.NEXT_PUBLIC_SITE_URL}/api/mail/unsubscribe?email=${encodeURIComponent(row.toEmail)}>, <mailto:unsubscribe@femiglow-maroc.com>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  const info = await transporter.sendMail({
    from: row.fromEmail,
    to: row.toName ? `${row.toName} <${row.toEmail}>` : row.toEmail,
    replyTo: row.replyTo ?? undefined,
    subject: row.subject,
    text: row.textSnapshot,
    html: row.htmlSnapshot,
    headers,
    messageId: undefined, // Stalwart generates one
  });

  const drizzle = requireDb();
  await drizzle
    .update(emailOutbox)
    .set({
      status: 'sent',
      attempts: (row.attempts ?? 0) + 1,
      smtpMessageId: info.messageId ?? null,
      smtpResponse: typeof info.response === 'string' ? info.response : null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(emailOutbox.id, row.id));

  await drizzle.insert(emailEvent).values({
    outboxId: row.id,
    type: 'sent',
    source: 'app',
    rawJson: { messageId: info.messageId, response: info.response } as any,
  });

  logger.info('mail.send.delivered_to_smtp', {
    outboxId: row.id,
    messageId: info.messageId,
  });
}

/**
 * Manual retry — resets failure state and lets the next cron pickup process it.
 */
export async function retryOutbox(outboxId: string): Promise<void> {
  const drizzle = requireDb();
  await drizzle
    .update(emailOutbox)
    .set({
      status: 'pending',
      attempts: 0,
      nextRetry: new Date(),
      lastError: null,
      updatedAt: new Date(),
    })
    .where(and(eq(emailOutbox.id, outboxId), inArray(emailOutbox.status, ['failed', 'dlq', 'bounced_soft'])));
}
