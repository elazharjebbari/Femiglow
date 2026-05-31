/**
 * /api/admin/emails/templates — list + create.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { createTemplate, listTemplates } from '@/lib/mail/templates/custom/queries';
import { CreateTemplateSchema } from '@/lib/mail/templates/custom/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  await requireAdmin('/api/admin/emails/templates');
  const rows = await listTemplates();
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await requireAdmin('/api/admin/emails/templates');
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }
  const parsed = CreateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  try {
    const created = await createTemplate(parsed.data, session.email);
    logger.info('admin.emails.template.created', {
      actor: session.email,
      templateId: created.id,
      slug: created.slug,
    });
    return NextResponse.json(created);
  } catch (err) {
    const msg = String(err);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json({ error: 'Slug déjà utilisé' }, { status: 409 });
    }
    logger.error('admin.emails.template.create_failed', { error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
