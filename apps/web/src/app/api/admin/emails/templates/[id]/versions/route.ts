/**
 * GET = list versions, POST = save new version.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { listVersions, saveTemplateVersion } from '@/lib/mail/templates/custom/queries';
import { SaveVersionSchema } from '@/lib/mail/templates/custom/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  await requireAdmin('/api/admin/emails/templates/versions');
  const versions = await listVersions(ctx.params.id);
  return NextResponse.json(versions);
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await requireAdmin('/api/admin/emails/templates/versions');
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }
  const parsed = SaveVersionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  try {
    const version = await saveTemplateVersion(ctx.params.id, parsed.data, session.email);
    logger.info('admin.emails.template.version_saved', {
      actor: session.email,
      templateId: ctx.params.id,
      versionNumber: version.versionNumber,
    });
    return NextResponse.json(version);
  } catch (err) {
    logger.error('admin.emails.template.save_version_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
