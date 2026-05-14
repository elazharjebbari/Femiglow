/**
 * POST /api/admin/emails/audiences/preview-size
 *
 * Body : { rules, exclusionFlags? } — returns { size, durationMs }.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { previewAudienceSize } from '@/lib/mail/audiences/preview';
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
  await requireAdmin('/api/admin/emails/audiences/preview-size');

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
    logger.error('admin.emails.audience.preview_size_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
