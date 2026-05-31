/**
 * Seed admin : reseed les 9 pages légales depuis docs/legal-pages/60-content.
 *
 * Idempotent (préserve les éditions admin : ne touche pas si status != draft
 * ou body_md modifié). Redirige vers /admin/legal après succès.
 */
import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { logAuditEvent } from '@/lib/audit/log-event';
import { redirectToPublic } from '@/lib/http/redirect-public';
import { seedLegalPages } from '../../../../../../scripts/seed-legal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await requireAdmin('/api/admin/legal/seed-defaults');

  let report: Awaited<ReturnType<typeof seedLegalPages>>;
  try {
    report = await seedLegalPages({ force: false });
  } catch (err) {
    logger.error('legal.admin.seed_failed', {
      error: (err as Error).message,
      by: session.email,
    });
    return NextResponse.json(
      { error: 'seed-failed', message: (err as Error).message },
      { status: 500 },
    );
  }

  await logAuditEvent({
    action: 'legal.seed_defaults',
    actorId: session.email,
    meta: report as unknown as Record<string, unknown>,
  });

  logger.info('legal.admin.seeded', { ...report, by: session.email });

  revalidatePath('/admin/legal');

  // Form POST → redirect 303 vers la page ; API JSON → renvoie le rapport.
  const accept = req.headers.get('accept') ?? '';
  if (accept.includes('application/json')) {
    return NextResponse.json({ ok: true, report });
  }
  return redirectToPublic(req, '/admin/legal?ok=seeded');
}
