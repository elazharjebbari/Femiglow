/**
 * OWBS F11 — GET /api/admin/leads/outbox
 *
 * Supervision opérateur de `lead_event_outbox` : compteurs par statut + listes
 * des effets `dead` (à rejouer) et `pending`. Auth admin requise.
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { leadOutboxRepo } from '@/lib/leads/outbox/lead-outbox-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const [counts, dead, pending] = await Promise.all([
      leadOutboxRepo.counts(),
      leadOutboxRepo.listByStatus('dead', 50),
      leadOutboxRepo.listByStatus('pending', 50),
    ]);
    return NextResponse.json({ counts, dead, pending });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
