import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logLegalEvent } from '@/lib/legal/audit';
import {
  LEGAL_PAGE_TAG,
  LEGAL_ZONE_TAG,
} from '@/lib/legal/cache-tags';
import { requireSameOrigin } from '@/lib/legal/csrf';
import { listAllPlacements, listAllZones, upsertPlacement } from '@/lib/legal/repository';
import { legalPlacementInputSchema } from '@/lib/legal/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const [zones, matrix] = await Promise.all([listAllZones(), listAllPlacements()]);
    return NextResponse.json({
      zones: zones.map((z) => ({
        key: z.key,
        label: z.label,
        description: z.description,
        max_items_recommended: z.maxItemsRecommended,
        is_required: z.isRequired,
        display_order: z.displayOrder,
      })),
      matrix: matrix.map((m) => ({
        page_slug: m.pageSlug,
        zone_key: m.zoneKey,
        is_visible: m.isVisible,
        display_order: m.displayOrder,
        label_override: m.labelOverride,
      })),
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    requireSameOrigin(request);

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = legalPlacementInputSchema.safeParse(payload);
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

    await upsertPlacement(parsed.data);
    await logLegalEvent('legal.placement.upserted', session.adminId, parsed.data.pageSlug, {
      zone_key: parsed.data.zoneKey,
      is_visible: parsed.data.isVisible,
      display_order: parsed.data.displayOrder,
    });

    revalidatePath('/');
    revalidatePath(`/legal/${parsed.data.pageSlug}`);
    revalidateTag(LEGAL_ZONE_TAG(parsed.data.zoneKey));
    revalidateTag(LEGAL_PAGE_TAG(parsed.data.pageSlug));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
