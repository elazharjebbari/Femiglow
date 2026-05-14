/**
 * POST /api/admin/emails/transactional/bulk-retry
 *
 * Body : { ids: string[] }  (max 500)
 * Returns : { retried, skipped, skippedIds }
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { BulkRetrySchema } from '@/lib/mail/transactional/schemas';
import { bulkRetry } from '@/lib/mail/transactional/bulk-actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await requireAdmin('/api/admin/emails/transactional/bulk-retry');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = BulkRetrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await bulkRetry(parsed.data.ids);
    logger.info('admin.emails.bulk_retry', {
      actor: session.email,
      requested: parsed.data.ids.length,
      retried: result.retried,
      skipped: result.skipped,
    });
    return NextResponse.json(result);
  } catch (err) {
    logger.error('admin.emails.transactional.bulk_retry_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
