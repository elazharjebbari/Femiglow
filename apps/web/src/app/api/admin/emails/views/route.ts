/**
 * /api/admin/emails/views — saved views CRUD.
 *
 * GET ?scope=transactional → list (system + owned by current admin)
 * POST { name, scope, filterState } → create custom view
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { CreateViewSchema, SavedViewScopeSchema } from '@/lib/mail/transactional/schemas';
import {
  createView,
  listViewsForAdmin,
} from '@/lib/mail/transactional/views-queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await requireAdmin('/api/admin/emails/views');

  const url = new URL(req.url);
  const parsed = SavedViewScopeSchema.safeParse(url.searchParams.get('scope') ?? 'transactional');
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid scope', issues: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const views = await listViewsForAdmin(session.email, parsed.data);
    return NextResponse.json(views);
  } catch (err) {
    logger.error('admin.emails.views.list_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireAdmin('/api/admin/emails/views');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = CreateViewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const created = await createView(session.email, parsed.data);
    logger.info('admin.emails.views.created', {
      actor: session.email,
      viewId: created.id,
      scope: created.scope,
    });
    return NextResponse.json(created);
  } catch (err) {
    const msg = String(err);
    // Erreur unique constraint = 409
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Une vue avec ce nom existe déjà pour ce scope' },
        { status: 409 },
      );
    }
    logger.error('admin.emails.views.create_failed', { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
