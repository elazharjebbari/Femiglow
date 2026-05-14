/**
 * /api/admin/emails/views/[id]
 *
 * PATCH { name?, filterState? } → update (refuse system + autre owner)
 * DELETE                        → soft delete (idem)
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { UpdateViewSchema } from '@/lib/mail/transactional/schemas';
import { deleteView, updateView } from '@/lib/mail/transactional/views-queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await requireAdmin('/api/admin/emails/views');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = UpdateViewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const updated = await updateView(ctx.params.id, session.email, parsed.data);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    const msg = String(err);
    if (msg.includes('Cannot edit')) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    logger.error('admin.emails.views.update_failed', { error: msg, viewId: ctx.params.id });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const session = await requireAdmin('/api/admin/emails/views');

  try {
    const ok = await deleteView(ctx.params.id, session.email);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    logger.info('admin.emails.views.deleted', { actor: session.email, viewId: ctx.params.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = String(err);
    if (msg.includes('Cannot delete')) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    logger.error('admin.emails.views.delete_failed', { error: msg, viewId: ctx.params.id });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
