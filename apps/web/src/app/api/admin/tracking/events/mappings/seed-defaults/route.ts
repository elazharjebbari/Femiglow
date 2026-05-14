/**
 * Seed admin : reseed le factory event-mapping (__default__) depuis
 * docs/event-mappings/20-data/default-mapping.json.
 *
 * Différent de /reset-default qui se contente d'activer __default__ : ce
 * endpoint RECHARGE les mappings depuis le JSON (cas où __default__ a été
 * inséré vide en DB et le bouton "Restore factory" ne sert à rien).
 *
 * Idempotent. Redirige vers /admin/tracking/events/mappings après succès.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { logAuditEvent } from '@/lib/audit/log-event';
import { redirectToPublic } from '@/lib/http/redirect-public';
import { runEventMappingsSeed } from '../../../../../../../../scripts/event-mappings/seed-event-mappings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await requireAdmin('/api/admin/tracking/events/mappings/seed-defaults');

  let report: Awaited<ReturnType<typeof runEventMappingsSeed>>;
  try {
    report = await runEventMappingsSeed();
  } catch (err) {
    logger.error('tracking.mappings.seed_failed', {
      error: (err as Error).message,
      by: session.email,
    });
    return NextResponse.json(
      { error: 'seed-failed', message: (err as Error).message },
      { status: 500 },
    );
  }

  await logAuditEvent({
    action: 'tracking.mappings.seed_defaults',
    actorId: session.email,
    meta: report as unknown as Record<string, unknown>,
  });

  logger.info('tracking.mappings.seeded', { by: session.email, report });

  const accept = req.headers.get('accept') ?? '';
  if (accept.includes('application/json')) {
    return NextResponse.json({ ok: true, report });
  }
  return redirectToPublic(req, '/admin/tracking/events/mappings?ok=seeded');
}
