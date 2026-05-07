/**
 * PATCH  /api/admin/components/[key]/bindings/[bindingId] — toggle isActive.
 * DELETE /api/admin/components/[key]/bindings/[bindingId] — supprime le binding.
 */
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import {
  deleteBinding,
  setBindingActive,
  listBindingsByComponent,
  upsertBinding,
} from '@/lib/db/queries/component-bindings';
import { bindingActivateSchema } from '@/lib/schemas/admin/components';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: { key: string; bindingId: string };
}

async function ensureBinding(ctx: Ctx) {
  const cmp = await getSiteComponentByKey(ctx.params.key);
  if (!cmp) throw new HttpError('not_found', 'Composant introuvable');
  const all = await listBindingsByComponent(cmp.id);
  const binding = all.find((b) => b.id === ctx.params.bindingId);
  if (!binding) throw new HttpError('not_found', 'Binding introuvable');
  return { cmp, binding };
}

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const { cmp, binding } = await ensureBinding(ctx);
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = bindingActivateSchema.safeParse(json);
    if (!parsed.success)
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());

    const patch = parsed.data;

    // Toggle isActive si fourni — backward compat.
    if (patch.isActive !== undefined) {
      await setBindingActive(binding.id, patch.isActive);
    }

    // Display modes / strategy : on passe par upsertBinding (mêmes id+slot)
    // pour conserver une seule porte d'entrée et bénéficier du merge.
    const hasDisplayPatch =
      patch.objectFit !== undefined ||
      patch.objectPosition !== undefined ||
      patch.focalX !== undefined ||
      patch.focalY !== undefined ||
      patch.loadingStrategy !== undefined ||
      patch.fetchPriority !== undefined ||
      patch.placeholderStrategy !== undefined;
    if (hasDisplayPatch) {
      await upsertBinding({
        componentId: binding.componentId,
        slot: binding.slot,
        mediaId: binding.mediaId,
        objectFit: patch.objectFit,
        objectPosition: patch.objectPosition,
        focalX: patch.focalX,
        focalY: patch.focalY,
        loadingStrategy: patch.loadingStrategy,
        fetchPriority: patch.fetchPriority,
        placeholderStrategy: patch.placeholderStrategy,
      });
    }

    await auditTrackingChange({
      action:
        patch.isActive === true
          ? 'enable'
          : patch.isActive === false
            ? 'disable'
            : 'update',
      resource: 'component_media_binding',
      resourceId: binding.id,
      actorId: session.adminId,
      meta: { componentKey: cmp.key, slot: binding.slot },
    });
    revalidateTag('components');
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const { cmp, binding } = await ensureBinding(ctx);
    await deleteBinding(binding.id);
    await auditTrackingChange({
      action: 'delete',
      resource: 'component_media_binding',
      resourceId: binding.id,
      actorId: session.adminId,
      meta: { componentKey: cmp.key, slot: binding.slot },
    });
    revalidateTag('components');
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
