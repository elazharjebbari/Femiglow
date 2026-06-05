/**
 * POST /api/admin/emails/transactional/reap-stuck — « Libérer les envois bloqués »
 * (UX-COCKPIT-004).
 *
 * Requalifie les lignes outbox figées en `sending` (process crashé entre le
 * claim et l'envoi SMTP) : `reapStuckSending()` les repasse en `pending` (ou
 * `dlq` au plafond de tentatives). Jusque-là cette capacité opérateur critique
 * ne tournait QUE via cron — aucun bouton pour la déclencher à la demande.
 *
 * Auth admin requise, audit-loggée. Renvoie `{ reaped: number }`.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { logAuditEvent } from '@/lib/audit/log-event';
import { reapStuckSending } from '@/lib/mail/outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROUTE = '/api/admin/emails/transactional/reap-stuck';

export async function POST(): Promise<Response> {
  const session = await requireAdmin(ROUTE);

  try {
    const reaped = await reapStuckSending();
    await logAuditEvent({
      action: 'mail.outbox.reap_stuck',
      actorId: session.email,
      meta: { reaped },
    });
    logger.warn('admin.emails.reap_stuck', { actor: session.email, reaped });
    return NextResponse.json({ reaped });
  } catch (err) {
    logger.error('admin.emails.reap_stuck_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
