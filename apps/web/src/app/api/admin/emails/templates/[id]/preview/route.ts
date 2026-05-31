/**
 * POST /api/admin/emails/templates/[id]/preview
 *
 * Render le template avec le contexte d'un lead (ou mock). Retourne
 * { subject, preheader, html, variablesResolved }.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { logger } from '@/lib/logging/logger';
import { getTemplateById } from '@/lib/mail/templates/custom/queries';
import { buildEmailContext } from '@/lib/mail/templates/custom/context-resolver';
import { renderTemplate } from '@/lib/mail/templates/custom/render';
import { PreviewTemplateSchema } from '@/lib/mail/templates/custom/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: { id: string } }) {
  await requireAdmin('/api/admin/emails/templates/preview');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = PreviewTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Load template (we'll use parsed.data.htmlSource if provided for live edit,
  // otherwise fall back to stored htmlSource).
  const template = await getTemplateById(ctx.params.id);
  if (!template && !parsed.data.htmlSource) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const subjectTmpl = parsed.data.subjectTmpl ?? template?.subjectTmpl ?? 'Aperçu';
  const preheaderTmpl = parsed.data.preheaderTmpl ?? template?.preheaderTmpl ?? '';
  const htmlSource = parsed.data.htmlSource ?? template?.htmlSource ?? '';

  // Build context — utilise contextEmail si fourni, sinon mock
  const sampleEmail = parsed.data.contextEmail ?? 'preview-mock@femiglow.local';
  try {
    const context = await buildEmailContext(sampleEmail, {
      customVars: parsed.data.customVars,
    });
    const rendered = renderTemplate({ subjectTmpl, preheaderTmpl, htmlSource }, context);
    // Variables resolved : extraction des keys du context (sans `trigger` qui est nested)
    const variablesResolved = Object.keys(context).filter((k) => k !== 'trigger');
    return NextResponse.json({
      ...rendered,
      variablesResolved,
    });
  } catch (err) {
    logger.error('admin.emails.template.preview_failed', { error: String(err) });
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
