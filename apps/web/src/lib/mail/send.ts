/**
 * sendTransactional — entry point for transactional sends.
 *
 *  1. Idempotency check
 *  2. Suppression check
 *  3. Render
 *  4. INSERT outbox (status=pending)
 *  5. Immediate fire-and-forget attempt (cron picks up failures)
 *
 * Cf. docs/emailing/03-backend-integration.md §3.3 + 11-security-rgpd.md §3
 * for the List-Unsubscribe headers.
 */
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { env } from '@/lib/env';
import { db } from '@/lib/db/client';
import { emailOutbox } from '@/lib/db/schema-emails';
import { logger } from '@/lib/logging/logger';

import { getTemplateMeta, type TemplateRegistry, type TemplateSlug } from './catalog';
import { renderTemplate } from './render';
import { isSuppressed } from './suppression';
import { unsubscribeUrl } from './unsub-token';
import { attemptSend } from './outbox';

export type SendResult =
  | { status: 'queued'; outboxId: string }
  | { status: 'duplicate'; outboxId: string }
  | { status: 'suppressed'; outboxId: null };

export type SendInput<S extends TemplateSlug> = {
  template: S;
  to: { email: string; name?: string };
  payload: TemplateRegistry[S];
  idempotencyKey: string;
  scheduledFor?: Date;
  source?: string;
  createdByUserId?: string;
};

function normalize(email: string): string {
  return email.toLowerCase().trim();
}

export async function sendTransactional<S extends TemplateSlug>(
  input: SendInput<S>,
): Promise<SendResult> {
  const toEmail = normalize(input.to.email);

  // 1. Suppression list — fail-closed.
  if (await isSuppressed(toEmail)) {
    logger.info('mail.send.suppressed', {
      template: input.template,
      to: toEmail,
      idempotencyKey: input.idempotencyKey,
    });
    return { status: 'suppressed', outboxId: null };
  }

  // 2. Idempotency check.
  const existing = await db
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(eq(emailOutbox.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (existing.length > 0) {
    return { status: 'duplicate', outboxId: existing[0].id };
  }

  // 3. Render.
  const meta = getTemplateMeta(input.template);
  const { html, text, subject, preheader } = await renderTemplate(input.template, input.payload);

  // 4. Inject one-click unsubscribe URL placeholder into footer.
  let htmlWithUnsub = html;
  let textWithUnsub = text;
  try {
    const unsub = unsubscribeUrl(toEmail, env.NEXT_PUBLIC_SITE_URL);
    htmlWithUnsub = html.replaceAll('{{unsubscribe_url}}', unsub);
    textWithUnsub = text.replaceAll('{{unsubscribe_url}}', unsub);
  } catch {
    // MAIL_UNSUB_TOKEN_SECRET not configured (dev) — leave placeholder.
  }

  // 5. INSERT outbox row.
  const id = randomUUID();
  await db.insert(emailOutbox).values({
    id,
    idempotencyKey: input.idempotencyKey,
    template: input.template,
    templateVersion: meta.version,
    toEmail,
    toName: input.to.name ?? null,
    fromEmail: env.MAIL_FROM,
    replyTo: env.MAIL_REPLY_TO,
    subject,
    payloadJson: input.payload as Record<string, unknown>,
    htmlSnapshot: htmlWithUnsub,
    textSnapshot: textWithUnsub,
    status: 'pending',
    scheduledFor: input.scheduledFor ?? null,
    source: input.source ?? null,
    createdByUserId: input.createdByUserId ?? null,
  });

  logger.info('mail.send.queued', {
    outboxId: id,
    template: input.template,
    to: toEmail,
    idempotencyKey: input.idempotencyKey,
    scheduled: Boolean(input.scheduledFor),
    preheaderLength: preheader.length,
  });

  // 6. Immediate fire-and-forget attempt (cron will retry on failure).
  if (!input.scheduledFor) {
    void attemptSend(id).catch((err) => {
      logger.warn('mail.send.immediate_attempt_failed', {
        outboxId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  return { status: 'queued', outboxId: id };
}
