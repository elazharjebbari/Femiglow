/**
 * OWBS F11 — POST /api/admin/leads/outbox/[id]/replay
 *
 * Rejoue un effet `dead` (le repasse `pending`, `attempts=0`). Auth admin requise.
 * Refuse les non-`dead` (anti-erreur) → 404.
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { leadOutboxRepo } from '@/lib/leads/outbox/lead-outbox-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const ok = await leadOutboxRepo.replay(params.id);
    if (!ok) {
      throw new HttpError('not_found', 'Effet introuvable ou non rejouable (doit être dead).');
    }
    await logAuditEvent({
      action: 'lead_outbox.replay',
      actorId: session.adminId,
      resourceType: 'lead_outbox',
      resourceId: params.id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
