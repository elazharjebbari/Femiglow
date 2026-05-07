import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  listTrackingComponents,
  upsertTrackingComponent,
} from '@/lib/db/queries/tracking/components';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

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
] as const;

const upsertSchema = z
  .object({
    name: z.string().min(1).max(120),
    path: z.string().min(1).max(255),
    category: z.enum(COMPONENT_CATEGORIES),
    description: z.string().max(2000).nullable().optional(),
    enabled: z.boolean().optional(),
    defaultParams: z.record(z.unknown()).optional(),
  })
  .strict();

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const url = new URL(request.url);
    const includeDeleted = url.searchParams.get('includeDeleted') === '1';
    const components = await listTrackingComponents({ includeDeleted });
    return NextResponse.json({ components });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = upsertSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Données invalides', parsed.error.flatten());
    }
    const component = await upsertTrackingComponent({
      name: parsed.data.name,
      path: parsed.data.path,
      category: parsed.data.category,
      description: parsed.data.description ?? null,
      enabled: parsed.data.enabled,
      defaultParams: parsed.data.defaultParams,
    });
    await auditTrackingChange({
      action: 'update',
      resource: 'tracking_component',
      resourceId: component.id,
      actorId: session.adminId,
      meta: { path: component.path, category: component.category },
    });
    return NextResponse.json({ component });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
