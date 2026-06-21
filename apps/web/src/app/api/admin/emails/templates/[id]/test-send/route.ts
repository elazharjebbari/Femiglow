/**
 * POST /api/admin/emails/templates/[id]/test-send  (F07 P3.4-g, Lot 4)
 *
 * Envoie une ÉPREUVE du template à une adresse : render custom (SANITIZÉ par
 * renderTemplate) → insertion outbox `source='template-test'` (snapshots
 * pré-rendus) → tentative best-effort (le cron reprend les échecs). On NE passe
 * PAS par sendTransactional (réservé aux slugs enregistrés).
 *
 * Sécurité (G12) : authz admin, Zod, rate-limit per-admin (anti-abus — vrai
 * e-mail), corps sanitizé au render, PII destinataire MASQUÉE dans l'audit.
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

import { env } from '@/lib/env';
import { db as getDb } from '@/lib/db/client';
import { emailOutbox } from '@/lib/db/schema-emails';
import { logger } from '@/lib/logging/logger';
import { logAuditEvent } from '@/lib/audit/log-event';
import { checkRateLimit } from '@/lib/rate-limit/check';
import { maskEmail } from '@/lib/mail/pii';
import { getAdminSession } from '@/lib/auth/require-admin';
import { TEST_SEND_RATE_LIMIT } from '@/lib/admin/emails/campaigns-shared';
import { getTemplateById } from '@/lib/mail/templates/custom/queries';
import { buildEmailContext } from '@/lib/mail/templates/custom/context-resolver';
import { renderTemplate } from '@/lib/mail/templates/custom/render';
import { TestSendSchema } from '@/lib/mail/templates/custom/schemas';
import { attemptSend } from '@/lib/mail/outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Texte alternatif minimal pour le part text/plain (deliverRow l'exige). */
function htmlToText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/div|\/h[1-6]|\/li)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  // getAdminSession (401 JSON) plutôt que requireAdmin (redirect HTML) : endpoint
  // appelé en fetch → on veut un statut JSON exploitable côté éditeur.
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  // Rate-limit per-admin : un test-send envoie un VRAI e-mail (anti-abus/spam).
  const rl = await checkRateLimit({
    key: `mail:template-test-send:${session.email}`,
    limit: TEST_SEND_RATE_LIMIT.limit,
    windowMs: TEST_SEND_RATE_LIMIT.windowMs,
  });
  if (!rl.ok) {
    logger.warn('template.test_send_rate_limited', { actor: session.email, templateId: ctx.params.id });
    const retryS = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: `Trop d'envois de test (max ${TEST_SEND_RATE_LIMIT.limit}/min). Réessaie dans ${retryS} s.` },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }
  const parsed = TestSendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const template = await getTemplateById(ctx.params.id);
  if (!template) {
    return NextResponse.json({ error: 'Template introuvable' }, { status: 404 });
  }

  // Contexte de perso : contextEmail si fourni, sinon le destinataire lui-même.
  const ctxEmail = parsed.data.contextEmail ?? parsed.data.recipient;
  let rendered;
  try {
    const context = await buildEmailContext(ctxEmail, {});
    rendered = renderTemplate(
      {
        subjectTmpl: template.subjectTmpl,
        preheaderTmpl: template.preheaderTmpl ?? '',
        htmlSource: template.htmlSource,
      },
      context,
    ); // html SANITIZÉ par renderTemplate
  } catch (err) {
    logger.error('template.test_send_render_failed', { templateId: ctx.params.id, error: String(err) });
    return NextResponse.json({ error: `Rendu impossible : ${String(err)}` }, { status: 422 });
  }

  const outboxId = randomUUID();
  const drizzle = getDb();
  if (!drizzle) {
    return NextResponse.json({ error: 'Base de données indisponible' }, { status: 500 });
  }
  await drizzle.insert(emailOutbox).values({
    id: outboxId,
    idempotencyKey: `tpl-test:${outboxId}`,
    template: `custom:${template.slug}`,
    templateVersion: 0, // épreuve (pas une version d'envoi de masse)
    toEmail: parsed.data.recipient,
    fromEmail: env.MAIL_FROM,
    replyTo: env.MAIL_REPLY_TO,
    subject: rendered.subject,
    payloadJson: {},
    htmlSnapshot: rendered.html,
    textSnapshot: htmlToText(rendered.html),
    status: 'pending',
    source: 'template-test',
    createdByUserId: session.email,
  });

  // Tentative immédiate best-effort : la ligne est tracée quoi qu'il arrive (le
  // cron reprendra un échec transitoire / SMTP non configuré).
  try {
    await attemptSend(outboxId);
  } catch (err) {
    logger.warn('template.test_send_deferred', {
      templateId: ctx.params.id,
      outboxId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info('template.test_send', { templateId: ctx.params.id, actor: session.email, outboxId });
  await logAuditEvent({
    action: 'mail.template.test_sent',
    actorId: session.email,
    resourceId: ctx.params.id,
    // F07-S — minimisation PII : destinataire masqué dans l'audit.
    meta: { to: maskEmail(parsed.data.recipient), outboxId },
  });

  return NextResponse.json({ status: 'queued', outboxId });
}
