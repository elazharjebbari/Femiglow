/**
 * S3.2 — Weekly digest of social-publishing failures.
 *
 * Schedule: `0 7 * * 1` (monday 07:00 UTC), to be wired in the external
 * cron config alongside the other content-studio crons.
 *
 * Security: Bearer `CRON_SECRET` (same pattern as the other crons).
 *
 * Config:
 *  - SOCIAL_DIGEST_RECIPIENT (fallback CHAT_DIGEST_RECIPIENT) — destinataire
 *  - CHAT_DIGEST_FROM — adresse expéditrice
 *  - MAIL_REPLY_TO    — reply-to par défaut
 *
 * Sans destinataire configuré, retourne 200 + { skipped: true } pour que le
 * cron ne soit pas marqué en erreur.
 */
import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logger } from '@/lib/logging/logger';
import { getEmailProvider } from '@/lib/rituals/email-provider';
import { buildWeeklyFailureDigest } from '@/lib/social-publishing/weekly-failure-digest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request): Promise<Response> {
  try {
    authorizeCron(request);

    const recipient = env.SOCIAL_DIGEST_RECIPIENT ?? env.CHAT_DIGEST_RECIPIENT;
    if (!recipient) {
      logger.info('social.cron.weekly_failure_digest_skipped', {
        reason: 'no-recipient-configured',
      });
      return NextResponse.json({ ok: true, skipped: true, reason: 'no-recipient' });
    }

    const digest = await buildWeeklyFailureDigest({ now: new Date() });
    const provider = getEmailProvider();
    const sent = await provider.send({
      to: recipient,
      rendered: {
        subject: digest.subject,
        preheader: null,
        from: env.CHAT_DIGEST_FROM ?? env.MAIL_FROM ?? 'noreply@femiglow.local',
        replyTo: env.MAIL_REPLY_TO ?? recipient,
        body: digest.html,
      },
    });

    if (!sent.ok) {
      logger.error('social.cron.weekly_failure_digest_failed', {
        recipient,
        total: digest.total,
        error: sent.error,
      });
      return NextResponse.json(
        { ok: false, error: sent.error ?? 'send-failed', total: digest.total },
        { status: 500 },
      );
    }

    logger.info('social.cron.weekly_failure_digest_sent', {
      recipient,
      total: digest.total,
      buckets: digest.buckets.length,
      provider: provider.name,
      messageId: sent.messageId,
    });
    return NextResponse.json({
      ok: true,
      total: digest.total,
      buckets: digest.buckets.length,
      provider: provider.name,
      messageId: sent.messageId,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

function authorizeCron(request: Request): void {
  const auth = request.headers.get('authorization');
  const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
  if (!expected || auth !== expected) {
    throw new HttpError('unauthorized', 'Bearer manquant ou invalide');
  }
}
