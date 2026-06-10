/**
 * POST /api/admin/emails/audiences/preview-size
 *
 * Body : { rules, exclusionFlags? } — returns { size, durationMs }.
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import {
  isStatementTimeoutError,
  previewAudienceSize,
} from '@/lib/mail/audiences/preview';
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
  // Route API : 401 JSON (pas de redirect login — pattern F02).
  const session = await getAdminSession();
  if (!session) {
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
    const result = await previewAudienceSize(
      parsed.data.rules,
      parsed.data.exclusionFlags ?? DEFAULT_EXCLUSIONS,
    );
    return NextResponse.json(result);
  } catch (err) {
    // AUD-13 — statement_timeout (57014) : 504 + erreur typée `timeout`,
    // jamais un 200 avec un faux 0 (F08-I-094).
    if (isStatementTimeoutError(err)) {
      logger.warn('admin.emails.audience.preview_size_timeout', { error: String(err) });
      return NextResponse.json(
        { error: 'timeout', message: 'Requête trop lourde — statement_timeout dépassé.' },
        { status: 504 },
      );
    }
    logger.error('admin.emails.audience.preview_size_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
