/**
 * GET/DELETE /api/admin/emails/templates/[id]
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { deleteTemplate, getTemplateById } from '@/lib/mail/templates/custom/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  await requireAdmin('/api/admin/emails/templates');
  const row = await getTemplateById(ctx.params.id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const session = await requireAdmin('/api/admin/emails/templates');
  try {
    const ok = await deleteTemplate(ctx.params.id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    logger.info('admin.emails.template.deleted', {
      actor: session.email,
      templateId: ctx.params.id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('admin.emails.template.delete_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
