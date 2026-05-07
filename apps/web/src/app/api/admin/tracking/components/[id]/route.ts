import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  findTrackingComponentById,
  softDeleteTrackingComponent,
  updateTrackingComponent,
} from '@/lib/db/queries/tracking/components';
import { auditTrackingChange } from '@/lib/tracking/server/audit';
import type { TrackingComponentCategory } from '@/lib/db/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COMPONENT_CATEGORIES = [
  'cta_primary',
  'cta_secondary',
  'cta_ghost',
  'navigation',
  'form_input',
  'form_submit',
  'media_image',
  'media_video',
  'media_audio',
  'list_item',
  'card',
  'pricing',
  'filter',
  'search',
  'social_share',
  'newsletter',
  'modal',
  'accordion',
  'tab',
  'carousel',
  'progress',
  'banner',
  'section_hero',
  'section_content',
  'section_testimonial',
  'section_faq',
  'commerce_cart',
  'commerce_checkout',
  'admin',
] as const satisfies readonly TrackingComponentCategory[];

const patchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    category: z.enum(COMPONENT_CATEGORIES).optional(),
    description: z.string().max(2000).nullable().optional(),
    enabled: z.boolean().optional(),
    defaultParams: z.record(z.unknown()).optional(),
  })
  .strict();

interface Ctx {
  params: { id: string };
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const component = await findTrackingComponentById(ctx.params.id);
    if (!component) throw new HttpError('not_found', 'Composant introuvable');
    return NextResponse.json({ component });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const existing = await findTrackingComponentById(ctx.params.id);
    if (!existing) throw new HttpError('not_found', 'Composant introuvable');
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Données invalides', parsed.error.flatten());
    }
    const updated = await updateTrackingComponent(ctx.params.id, parsed.data);
    await auditTrackingChange({
      action: parsed.data.enabled === true ? 'enable' : parsed.data.enabled === false ? 'disable' : 'update',
      resource: 'tracking_component',
      resourceId: updated.id,
      actorId: session.adminId,
      meta: parsed.data,
    });
    return NextResponse.json({ component: updated });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(_req: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const existing = await findTrackingComponentById(ctx.params.id);
    if (!existing) throw new HttpError('not_found', 'Composant introuvable');
    await softDeleteTrackingComponent(ctx.params.id);
    await auditTrackingChange({
      action: 'delete',
      resource: 'tracking_component',
      resourceId: ctx.params.id,
      actorId: session.adminId,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
