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
import { db as getDb } from '@/lib/db/client';
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
  | { status: 'suppressed'; outboxId: null }
  | { status: 'failed'; outboxId: string };

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
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  const existing = await drizzle
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(eq(emailOutbox.idempotencyKey, input.idempotencyKey))
    .limit(1);
  if (existing.length > 0 && existing[0]) {
    return { status: 'duplicate', outboxId: existing[0].id };
  }

  // 3. INSERT outbox row FIRST (status=pending), AVANT tout render/validation.
  //
  //    Pourquoi cet ordre ? Le render fait `meta.schema.parse(payload)` (Zod) et
  //    `@react-email/render`, qui peuvent *throw* sur un payload invalide. Si le
  //    render précédait l'INSERT (ancien ordre), un payload invalide = exception
  //    remontée au caller — or les call-sites font `void sendTransactional(...)`
  //    (fire-and-forget) : l'email était PERDU sans aucune ligne en DB, donc
  //    invisible du cockpit admin et impossible à diagnostiquer.
  //
  //    En insérant d'abord une ligne `pending` (avec l'idempotencyKey — donc
  //    l'unicité/anti-doublon est posée dès maintenant — et le payload brut), on
  //    garantit une TRACE quoi qu'il arrive. Le `subject` est notNull en DB → on
  //    pose un placeholder, remplacé par le vrai sujet après un render réussi.
  const meta = getTemplateMeta(input.template);
  const id = randomUUID();
  await drizzle.insert(emailOutbox).values({
    id,
    idempotencyKey: input.idempotencyKey,
    template: input.template,
    templateVersion: meta.version,
    toEmail,
    toName: input.to.name ?? null,
    fromEmail: env.MAIL_FROM,
    replyTo: env.MAIL_REPLY_TO,
    subject: '(rendering…)',
    payloadJson: input.payload as Record<string, unknown>,
    htmlSnapshot: null,
    textSnapshot: null,
    status: 'pending',
    scheduledFor: input.scheduledFor ?? null,
    source: input.source ?? null,
    createdByUserId: input.createdByUserId ?? null,
  });

  // 4. Render — peut throw (Zod / react-email). En cas d'échec : on marque la
  //    ligne `failed` + `lastError` parlant et on RETOURNE sans tenter d'envoi
  //    SMTP (un render raté ne sera jamais réparé par un retour cron — c'est un
  //    bug de payload côté appelant, pas une erreur transitoire).
  let rendered: Awaited<ReturnType<typeof renderTemplate>>;
  try {
    rendered = await renderTemplate(input.template, input.payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await drizzle
      .update(emailOutbox)
      .set({
        status: 'failed',
        lastError: `render failed: ${message}`,
        updatedAt: new Date(),
      })
      .where(eq(emailOutbox.id, id));
    logger.error('mail.send.render_failed', {
      outboxId: id,
      template: input.template,
      idempotencyKey: input.idempotencyKey,
      error: message,
    });
    return { status: 'failed', outboxId: id };
  }

  const { html, text, subject, preheader } = rendered;

  // 5. Inject one-click unsubscribe URL placeholder into footer.
  //
  // UX-PUB-007 — si `MAIL_UNSUB_TOKEN_SECRET` manque, `unsubscribeUrl` throw.
  // On NE laisse PLUS le placeholder littéral `{{unsubscribe_url}}` dans l'email :
  // cela produisait un `href="{{unsubscribe_url}}"` cliquable mais cassé (lien
  // invalide + email sans mécanisme de désabonnement = non-conformité). À la
  // place, on bascule le lien vers un canal de désabonnement DE SECOURS réel
  // (mailto vers l'adresse de réponse) et on logge une erreur explicite pour
  // que l'absence de secret soit visible en exploitation.
  let htmlWithUnsub = html;
  let textWithUnsub = text;
  try {
    const unsub = unsubscribeUrl(toEmail, env.NEXT_PUBLIC_SITE_URL);
    htmlWithUnsub = html.replaceAll('{{unsubscribe_url}}', unsub);
    textWithUnsub = text.replaceAll('{{unsubscribe_url}}', unsub);
  } catch {
    logger.error('mail.send.unsub_secret_missing', {
      outboxId: id,
      template: input.template,
      detail:
        'MAIL_UNSUB_TOKEN_SECRET absent — fallback mailto pour le lien de désabonnement (évite un href littéral cassé).',
    });
    const fallback = `mailto:${env.MAIL_REPLY_TO}?subject=${encodeURIComponent('Désabonnement')}`;
    htmlWithUnsub = html.replaceAll('{{unsubscribe_url}}', fallback);
    textWithUnsub = text.replaceAll('{{unsubscribe_url}}', fallback);
  }

  // 6. UPDATE la ligne avec le rendu (snapshots + vrai sujet).
  await drizzle
    .update(emailOutbox)
    .set({
      subject,
      htmlSnapshot: htmlWithUnsub,
      textSnapshot: textWithUnsub,
      updatedAt: new Date(),
    })
    .where(eq(emailOutbox.id, id));

  logger.info('mail.send.queued', {
    outboxId: id,
    template: input.template,
    to: toEmail,
    idempotencyKey: input.idempotencyKey,
    scheduled: Boolean(input.scheduledFor),
    preheaderLength: preheader.length,
  });

  // 7. Immediate fire-and-forget attempt (cron will retry on failure).
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
