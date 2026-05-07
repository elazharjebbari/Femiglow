/**
 * GET   /api/admin/seo/settings → singleton seo_settings (avec defaults TS si vide)
 * PATCH /api/admin/seo/settings → update + revalidate global SEO
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { getSeoSettings, upsertSeoSettings } from '@/lib/db/queries/seo';
import { seoSettingsUpsertSchema } from '@/lib/seo/schemas';
import { SEO_TAG } from '@/lib/seo/resolve';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const settings = await getSeoSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = seoSettingsUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Settings invalides',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }
    const updated = await upsertSeoSettings({ ...parsed.data, actorId: session.adminId });
    revalidateTag(SEO_TAG);
    await logAuditEvent({
      action: 'seo.settings.update',
      actorId: session.adminId,
      resourceType: 'seo_settings',
      resourceId: 'singleton',
      meta: { fields: Object.keys(parsed.data) },
    });
    return NextResponse.json({ settings: updated });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
