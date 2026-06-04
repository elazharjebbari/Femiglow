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

/**
 * Reaper threshold — un délai au-delà duquel une ligne restée en `sending` est
 * considérée comme orpheline (process crashé/redémarré entre le claim et le
 * passage à un statut terminal). En prod, `next start` est redémarré à chaque
 * build (~toutes les heures lors d'un déploiement) ; sans reaper, une ligne
 * claimée juste avant le restart reste `sending` POUR TOUJOURS — jamais reprise
 * par le cron (qui ne regarde que `pending`/`failed`) et donc email perdu sans
 * trace de retry.
 *
 * 10 min : largement au-dessus de la durée d'un envoi SMTP normal (timeout
 * socket = 30 s côté client.ts) et du `maxDuration = 60` du cron, donc aucune
 * ligne en cours d'envoi légitime ne sera reapée par erreur.
 */
export const REAP_THRESHOLD_MS = 10 * 60_000; // 10 minutes

export type BatchResult = {
  picked: number;
  succeeded: number;
  failed: number;
  dlq: number;
  reaped: number;
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
 * Reaper — requalifie les lignes restées en `sending` plus longtemps que
 * `REAP_THRESHOLD_MS`. Ces lignes ont été claimées (UPDATE → 'sending') puis le
 * process est mort avant de les amener à un statut terminal (`sent`/`failed`/
 * `dlq`). Sans ce balayage, elles ne sont JAMAIS reprises : le claim du cron ne
 * regarde que `pending`/`failed`.
 *
 * Politique de requalification (un essai « brûlé » est compté pour ne pas
 * boucler indéfiniment sur une ligne empoisonnée) :
 *   - attempts+1 < max_attempts → `pending`, `next_retry = now` (reprise immédiate
 *     au prochain claim), `last_error` parlant pour la traçabilité ;
 *   - sinon → `dlq` (plafond atteint), `next_retry = NULL`.
 *
 * Fait en un seul UPDATE atomique (pas de course avec le claim qui suit : le
 * claim ne sélectionne que `pending`/`failed`, donc une ligne tout juste
 * requalifiée en `pending` redevient éligible — c'est voulu).
 */
export async function reapStuckSending(now: Date = new Date()): Promise<number> {
  const drizzle = requireDb();
  const cutoffMs = now.getTime() - REAP_THRESHOLD_MS;
  const reapError = `reaped: bloquée en 'sending' > ${Math.round(
    REAP_THRESHOLD_MS / 60_000,
  )}min (process probablement crashé/redémarré entre le claim et l'envoi)`;

  // UPDATE ... CASE en SQL brut : une seule requête, atomique. `to_timestamp`
  // borne la fenêtre ; `now()` Postgres pour next_retry (cf. note serialisation
  // Date dans pickAndProcessBatch). On compte attempts+1 ; au plafond → dlq.
  const result = (await drizzle.execute(sql`
    UPDATE email_outbox
    SET
      attempts = attempts + 1,
      status = (CASE
        WHEN attempts + 1 >= max_attempts THEN 'dlq'
        ELSE 'pending'
      END)::email_outbox_status,
      next_retry = CASE
        WHEN attempts + 1 >= max_attempts THEN NULL
        ELSE now()
      END,
      last_error = ${reapError},
      updated_at = now()
    WHERE status = 'sending'
      AND updated_at <= to_timestamp(${cutoffMs} / 1000.0)
    RETURNING id;
  `)) as unknown as { rows: { id: string }[] } | { id: string }[];

  const reaped = rowsOf(result);
  if (reaped.length > 0) {
    logger.warn('mail.outbox.reaped_stuck_sending', {
      count: reaped.length,
      thresholdMs: REAP_THRESHOLD_MS,
    });
  }
  return reaped.length;
}

/**
 * Cron pickup : claim a batch of outbox rows ready for retry and attempt them.
 */
export async function pickAndProcessBatch(now: Date = new Date()): Promise<BatchResult> {
  const drizzle = requireDb();
  const startedAt = Date.now();

  // 0. Reaper d'abord — récupère les lignes orphelines (`sending` figé) avant le
  // claim, de sorte que celles requalifiées en `pending` soient ramassées dans
  // le même tour.
  const reaped = await reapStuckSending(now);

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

  // RAW SQL execute returns snake_case columns ; map to camelCase EmailOutboxRow
  // shape so deliverRow can use Drizzle's $inferSelect typed fields.
  const list = rowsOf(result).map(normalizeRow);
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
    reaped,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Map a snake_case row (from raw SQL execute) to the camelCase EmailOutboxRow
 * shape expected by Drizzle's $inferSelect.
 */
function normalizeRow(raw: Record<string, unknown>): EmailOutboxRow {
  const r = raw as Record<string, unknown>;
  return {
    id: r.id as string,
    idempotencyKey: r.idempotency_key as string,
    template: r.template as string,
    templateVersion: r.template_version as number,
    toEmail: r.to_email as string,
    toName: (r.to_name as string | null) ?? null,
    fromEmail: r.from_email as string,
    replyTo: (r.reply_to as string | null) ?? null,
    subject: r.subject as string,
    payloadJson: r.payload_json as Record<string, unknown>,
    htmlSnapshot: (r.html_snapshot as string | null) ?? null,
    textSnapshot: (r.text_snapshot as string | null) ?? null,
    status: r.status as EmailOutboxRow['status'],
    attempts: r.attempts as number,
    maxAttempts: r.max_attempts as number,
    nextRetry: (r.next_retry as Date | null) ?? null,
    lastError: (r.last_error as string | null) ?? null,
    smtpMessageId: (r.smtp_message_id as string | null) ?? null,
    smtpResponse: (r.smtp_response as string | null) ?? null,
    queueId: (r.queue_id as string | null) ?? null,
    scheduledFor: (r.scheduled_for as Date | null) ?? null,
    deliveredAt: (r.delivered_at as Date | null) ?? null,
    bouncedAt: (r.bounced_at as Date | null) ?? null,
    bounceReason: (r.bounce_reason as string | null) ?? null,
    bounceType: (r.bounce_type as EmailOutboxRow['bounceType']) ?? null,
    source: (r.source as string | null) ?? null,
    createdByUserId: (r.created_by_user_id as string | null) ?? null,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
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
