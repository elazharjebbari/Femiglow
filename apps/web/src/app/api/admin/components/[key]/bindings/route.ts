/**
 * POST /api/admin/components/[key]/bindings
 *   Upsert d'un binding (componentKey, slot) → media.
 */
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getSiteComponentByKey, findSlot } from '@/lib/db/queries/site-components';
import { upsertBinding } from '@/lib/db/queries/component-bindings';
import { findMediaById } from '@/lib/db/queries/media';
import { bindingUpsertSchema } from '@/lib/schemas/admin/components';
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
    const parsed = bindingUpsertSchema.safeParse(json);
    if (!parsed.success)
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());

    const slotDef = await findSlot(cmp.key, parsed.data.slot);
    if (!slotDef)
      throw new HttpError('invalid_input', `Slot inconnu : ${parsed.data.slot}`);

    if (parsed.data.mediaId) {
      const media = await findMediaById(parsed.data.mediaId);
      if (!media) throw new HttpError('not_found', 'Média introuvable');
      if (!slotDef.acceptKinds.includes(media.kind as 'image' | 'video')) {
        throw new HttpError(
          'invalid_input',
          `Le slot accepte ${slotDef.acceptKinds.join('/')} mais reçoit ${media.kind}`,
        );
      }
    }

    const binding = await upsertBinding({
      componentId: cmp.id,
      slot: parsed.data.slot,
      mediaId: parsed.data.mediaId,
      loadingStrategy: parsed.data.loadingStrategy,
      fetchPriority: parsed.data.fetchPriority,
      priority: parsed.data.priority,
      placeholderStrategy: parsed.data.placeholderStrategy,
      customAlt: parsed.data.customAlt,
      displayOrder: parsed.data.displayOrder,
      isActive: parsed.data.isActive,
      notes: parsed.data.notes,
      createdBy: session.adminId,
    });

    await auditTrackingChange({
      action: parsed.data.mediaId ? 'assign' : 'unassign',
      resource: 'component_media_binding',
      resourceId: binding.id,
      actorId: session.adminId,
      meta: {
        componentKey: cmp.key,
        slot: parsed.data.slot,
        mediaId: parsed.data.mediaId,
        isActive: binding.isActive,
      },
    });
    revalidateTag('components');

    return NextResponse.json({ binding });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
