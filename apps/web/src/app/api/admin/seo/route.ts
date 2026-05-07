/**
 * GET  /api/admin/seo → liste paginée des overrides (filtres scope, search)
 * POST /api/admin/seo → création (ou upsert si {scope, targetKey, locale} déjà existant)
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { listOverrides, upsertOverride } from '@/lib/db/queries/seo';
import { seoOverrideUpsertSchema } from '@/lib/seo/schemas';
import { SEO_TAG, seoTargetTag } from '@/lib/seo/resolve';
import { SEO_SCOPES, type SeoScope } from '@/lib/seo/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const url = new URL(request.url);
    const scopeRaw = url.searchParams.get('scope');
    const scope =
      scopeRaw && SEO_SCOPES.includes(scopeRaw as SeoScope) ? (scopeRaw as SeoScope) : undefined;
    const search = url.searchParams.get('search') || undefined;
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? '50')));
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? '0'));
    const { items, total } = await listOverrides({ scope, search, limit, offset });
    return NextResponse.json({ items, total, limit, offset });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = seoOverrideUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Payload invalide',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }
    const created = await upsertOverride({ ...parsed.data, actorId: session.adminId });

    revalidateTag(SEO_TAG);
    revalidateTag(seoTargetTag(created.scope, created.targetKey));
    await logAuditEvent({
      action: 'seo.create',
      actorId: session.adminId,
      resourceType: 'seo_override',
      resourceId: created.id,
      meta: { scope: created.scope, targetKey: created.targetKey, locale: created.locale },
    });
    return NextResponse.json({ override: created }, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
