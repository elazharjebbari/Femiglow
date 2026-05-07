/**
 * POST /api/admin/components/[key]/animations
 *   Upsert d'un binding d'animation (componentKey, animationKey).
 *   Si `isDefault=true`, retire le default des autres bindings du composant.
 */
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import {
  getAnimationByKey,
  upsertAnimationBinding,
} from '@/lib/db/queries/component-animations';
import { animationBindingUpsertSchema } from '@/lib/schemas/admin/components';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: { key: string };
}

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const cmp = await getSiteComponentByKey(ctx.params.key);
    if (!cmp) throw new HttpError('not_found', 'Composant introuvable');
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = animationBindingUpsertSchema.safeParse(json);
    if (!parsed.success)
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());
    const animation = await getAnimationByKey(parsed.data.animationKey);
    if (!animation) throw new HttpError('not_found', 'Profil d’animation introuvable');
    const binding = await upsertAnimationBinding({
      componentId: cmp.id,
      animationId: animation.id,
      isDefault: parsed.data.isDefault,
      params: parsed.data.params,
    });
    await auditTrackingChange({
      action: 'assign',
      resource: 'component_animation_binding',
      resourceId: binding.id,
      actorId: session.adminId,
      meta: { componentKey: cmp.key, animationKey: animation.key, isDefault: binding.isDefault },
    });
    revalidateTag('components');
    return NextResponse.json({ binding, animation });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
