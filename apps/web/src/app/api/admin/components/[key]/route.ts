/**
 * GET    /api/admin/components/[key] — détail d'un composant + bindings + animations.
 * PATCH  /api/admin/components/[key] — mise à jour des champs admin (description, fallback…).
 */
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  getSiteComponentByKey,
  updateSiteComponent,
} from '@/lib/db/queries/site-components';
import { listBindingsWithMediaByComponent } from '@/lib/db/queries/component-bindings';
import { listAnimationBindingsWithAnimation } from '@/lib/db/queries/component-animations';
import { componentUpdateSchema } from '@/lib/schemas/admin/components';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: { key: string };
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const cmp = await getSiteComponentByKey(ctx.params.key);
    if (!cmp) throw new HttpError('not_found', 'Composant introuvable');
    const bindings = await listBindingsWithMediaByComponent(cmp.id);
    const animations = await listAnimationBindingsWithAnimation(cmp.id);
    return NextResponse.json({ component: cmp, bindings, animations });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const cmp = await getSiteComponentByKey(ctx.params.key);
    if (!cmp) throw new HttpError('not_found', 'Composant introuvable');
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = componentUpdateSchema.safeParse(json);
    if (!parsed.success) throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());
    const updated = await updateSiteComponent(cmp.id, parsed.data);
    if (!updated) throw new HttpError('not_found', 'Composant introuvable');
    await auditTrackingChange({
      action: 'update',
      resource: 'site_component',
      resourceId: cmp.id,
      actorId: session.adminId,
      meta: { key: cmp.key, fields: Object.keys(parsed.data) },
    });
    revalidateTag('components');
    return NextResponse.json({ component: updated });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
