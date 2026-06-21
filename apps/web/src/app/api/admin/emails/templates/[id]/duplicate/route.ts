/**
 * POST /api/admin/emails/templates/[id]/duplicate
 *
 * Duplique un template (contenu courant) sous un slug dérivé libre + nom
 * « (copie) ». Repart d'un historique propre (v1). Renvoie le template créé.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { duplicateTemplate } from '@/lib/mail/templates/custom/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  const session = await requireAdmin('/api/admin/emails/templates');
  try {
    const created = await duplicateTemplate(ctx.params.id, session.email);
    if (!created) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    logger.info('admin.emails.template.duplicated', {
      actor: session.email,
      sourceId: ctx.params.id,
      templateId: created.id,
      slug: created.slug,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    logger.error('admin.emails.template.duplicate_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
