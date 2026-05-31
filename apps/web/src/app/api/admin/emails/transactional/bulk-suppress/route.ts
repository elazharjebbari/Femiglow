/**
 * POST /api/admin/emails/transactional/bulk-suppress
 *
 * Ajoute les destinataires des outbox sélectionnés en email_suppression
 * (raison manual_admin par défaut). Marque les outbox concernés en
 * status=suppressed.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { BulkSuppressSchema } from '@/lib/mail/transactional/schemas';
import { bulkSuppress } from '@/lib/mail/transactional/bulk-actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await requireAdmin('/api/admin/emails/transactional/bulk-suppress');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = BulkSuppressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await bulkSuppress(parsed.data.ids, parsed.data.reason ?? 'manual_admin');
    logger.warn('admin.emails.bulk_suppress', {
      actor: session.email,
      requested: parsed.data.ids.length,
      suppressed: result.suppressed,
      reason: parsed.data.reason ?? 'manual_admin',
    });
    return NextResponse.json(result);
  } catch (err) {
    logger.error('admin.emails.transactional.bulk_suppress_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
