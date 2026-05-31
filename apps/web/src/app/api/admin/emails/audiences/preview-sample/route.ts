/**
 * POST /api/admin/emails/audiences/preview-sample
 *
 * Body : { rules, exclusionFlags?, limit? } — returns { samples, size }.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { previewAudienceSample } from '@/lib/mail/audiences/preview';
import { PreviewSampleSchema } from '@/lib/mail/audiences/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_EXCLUSIONS = {
  hard_bounce: true,
  unsubscribe: true,
  manual_suppression: true,
  marketing_optout: false,
};

export async function POST(req: Request) {
  await requireAdmin('/api/admin/emails/audiences/preview-sample');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = PreviewSampleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await previewAudienceSample(
      parsed.data.rules,
      parsed.data.exclusionFlags ?? DEFAULT_EXCLUSIONS,
      parsed.data.limit,
    );
    return NextResponse.json(result);
  } catch (err) {
    logger.error('admin.emails.audience.preview_sample_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
