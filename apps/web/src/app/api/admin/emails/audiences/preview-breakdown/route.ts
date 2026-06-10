/**
 * POST /api/admin/emails/audiences/preview-breakdown
 *
 * Body : { rules, exclusionFlags? } — returns { matched, excluded, deliverable,
 * durationMs }. Sépare la cible brute (rules seules) de la cible envoyable
 * (rules + exclusions) pour la santé du ciblage (UX-AUD-011).
 *
 * Route NOUVELLE (le chantier ne peut pas modifier preview-size). Auth admin,
 * validation Zod, erreurs JSON propres — calquée sur preview-size.
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { previewAudienceBreakdown } from '@/lib/mail/audiences/preview';
import { PreviewSchema } from '@/lib/mail/audiences/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_EXCLUSIONS = {
  hard_bounce: true,
  unsubscribe: true,
  manual_suppression: true,
  marketing_optout: false,
};

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = PreviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await previewAudienceBreakdown(
      parsed.data.rules,
      parsed.data.exclusionFlags ?? DEFAULT_EXCLUSIONS,
    );
    return NextResponse.json(result);
  } catch (err) {
    logger.error('admin.emails.audience.preview_breakdown_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
