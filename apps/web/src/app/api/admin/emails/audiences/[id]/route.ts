/**
 * /api/admin/emails/audiences/[id] — get / update / delete.
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import {
  deleteAudience,
  getAudienceById,
  updateAudience,
} from '@/lib/mail/audiences/queries';
import { UpdateAudienceSchema } from '@/lib/mail/audiences/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  const row = await getAudienceById(ctx.params.id);
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
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

  const parsed = UpdateAudienceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const updated = await updateAudience(ctx.params.id, parsed.data);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    logger.info('admin.emails.audience.updated', {
      actor: session.email,
      audienceId: ctx.params.id,
    });
    return NextResponse.json(updated);
  } catch (err) {
    logger.error('admin.emails.audience.update_failed', {
      error: String(err),
      audienceId: ctx.params.id,
    });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }
  try {
    const ok = await deleteAudience(ctx.params.id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    logger.info('admin.emails.audience.deleted', {
      actor: session.email,
      audienceId: ctx.params.id,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('admin.emails.audience.delete_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
