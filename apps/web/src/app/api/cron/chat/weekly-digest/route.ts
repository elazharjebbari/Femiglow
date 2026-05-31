/**
 * CHAT-067 — Cron hebdo : envoie le digest des leads chat à l'équipe Care.
 *
 * Schedule (à câbler dans vercel.json) : `0 7 * * 1` (lundi 07:00 UTC).
 *
 * Sécurité
 * ────────
 * `isAuthorizedCron` (Bearer CRON_SECRET) — comme les autres jobs.
 *
 * Configuration
 * ─────────────
 *  - CHAT_DIGEST_RECIPIENT : destinataire (sinon 200 + skipped:true)
 *  - CHAT_DIGEST_FROM      : adresse expéditrice
 *
 * Idempotence
 * ───────────
 * Le cron ne marque pas l'état "déjà envoyé" — Vercel garantit one-shot
 * par déclencheur, et un double envoi accidentel n'a pas d'effet de
 * bord négatif (pas de side-effect DB).
 */
import { type NextRequest, NextResponse } from 'next/server';

import { adminQueries } from '@/lib/chat/admin/queries';
import { isAuthorizedCron } from '@/lib/chat/services/auth-cron';
import { buildWeeklyDigest } from '@/lib/chat/services/weekly-digest';
import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import { getEmailProvider } from '@/lib/rituals/email-provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const recipient = env.CHAT_DIGEST_RECIPIENT;
  if (!recipient) {
    logger.info('chat.cron.weekly_digest_skipped', {
      reason: 'no-recipient-configured',
    });
    return NextResponse.json({ ok: true, skipped: true, reason: 'no-recipient' });
  }

  const now = new Date();
  const fromDate = new Date(now.getTime() - SEVEN_DAYS_MS);
  const leads = await adminQueries.listChatLeads({
    fromDate,
    toDate: now,
    limit: 1000,
  });

  const rendered = buildWeeklyDigest({
    leads,
    generatedAt: now,
    adminBaseUrl: env.NEXT_PUBLIC_SITE_URL,
    from: env.CHAT_DIGEST_FROM,
  });

  const provider = getEmailProvider();
  const sent = await provider.send({ to: recipient, rendered });

  if (!sent.ok) {
    logger.error('chat.cron.weekly_digest_failed', {
      recipient,
      total: leads.length,
      error: sent.error,
    });
    return NextResponse.json(
      { ok: false, error: sent.error ?? 'send-failed', total: leads.length },
      { status: 500 },
    );
  }

  logger.info('chat.cron.weekly_digest_sent', {
    recipient,
    total: leads.length,
    provider: provider.name,
    messageId: sent.messageId,
  });
  return NextResponse.json({
    ok: true,
    total: leads.length,
    provider: provider.name,
    messageId: sent.messageId,
  });
}
