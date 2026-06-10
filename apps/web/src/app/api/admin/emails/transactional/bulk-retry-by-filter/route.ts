/**
 * POST /api/admin/emails/transactional/bulk-retry-by-filter — relance par
 * FILTRE avec dry-count (CKPT-02 / F04 P2.3).
 *
 *  - `dry_run:true`  → { count } : nb d'emails ÉLIGIBLES (statuts relançables
 *    ∩ filtre), compte BORNÉ — alimente le ConfirmDialog ;
 *  - `dry_run:false` → vérifie le cap (10 000) PUIS relance : { retried,
 *    skipped:[{reason,count}] } ; dépassement → 422 { error:'cap_exceeded' } ;
 *  - réutilise buildWhere (compilateur unique) : l'ensemble touché est
 *    EXACTEMENT celui de /search pour le même filtre (F04-I-010) ;
 *  - audit `mail.outbox.bulk_retry_by_filter` { actor, filters, count, retried }.
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { logger } from '@/lib/logging/logger';
import { BulkRetryByFilterSchema } from '@/lib/mail/transactional/schemas';
import {
  bulkRetryByFilter,
  countRetryEligibleByFilter,
  BULK_BY_FILTER_CAP,
} from '@/lib/mail/transactional/bulk-actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 422 });
  }
  const parsed = BulkRetryByFilterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const { filterState, dry_run: dryRun } = parsed.data;

  try {
    const count = await countRetryEligibleByFilter(filterState);

    if (dryRun) {
      return NextResponse.json({ count });
    }

    if (count > BULK_BY_FILTER_CAP) {
      // AUCUNE mutation : l'opérateur doit affiner le filtre.
      return NextResponse.json(
        { error: 'cap_exceeded', count, cap: BULK_BY_FILTER_CAP },
        { status: 422 },
      );
    }

    const result = await bulkRetryByFilter(filterState);
    await logAuditEvent({
      action: 'mail.outbox.bulk_retry_by_filter',
      actorId: session.adminId ?? session.email,
      resourceType: 'email_outbox',
      meta: {
        filters_count: filterState.filters.length + (filterState.freetext ? 1 : 0),
        count,
        retried: result.retried,
        skipped: result.skipped,
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    logger.error('admin.emails.transactional.bulk_retry_by_filter_failed', {
      error: String(err),
    });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
