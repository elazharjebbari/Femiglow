/**
 * Seed admin : reseed les event mappings + providers analytics depuis
 * l'inventaire docs/dossier-tracking-v2.
 *
 * Idempotent. Redirige vers /admin/tracking après succès.
 */
import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { logAuditEvent } from '@/lib/audit/log-event';
import { redirectToPublic } from '@/lib/http/redirect-public';
import { runTrackingSeed } from '../../../../../../scripts/seed-tracking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await requireAdmin('/api/admin/tracking/seed-defaults');

  let report: Awaited<ReturnType<typeof runTrackingSeed>>;
  try {
    report = await runTrackingSeed({});
  } catch (err) {
    logger.error('tracking.admin.seed_failed', {
      error: (err as Error).message,
      by: session.email,
    });
    return NextResponse.json(
      { error: 'seed-failed', message: (err as Error).message },
      { status: 500 },
    );
  }

  await logAuditEvent({
    action: 'tracking.seed_defaults',
    actorId: session.email,
    meta: report as unknown as Record<string, unknown>,
  });

  logger.info('tracking.admin.seeded', { by: session.email });

  revalidatePath('/admin/tracking');

  const accept = req.headers.get('accept') ?? '';
  if (accept.includes('application/json')) {
    return NextResponse.json({ ok: true, report });
  }
  return redirectToPublic(req, '/admin/tracking?ok=seeded');
}
