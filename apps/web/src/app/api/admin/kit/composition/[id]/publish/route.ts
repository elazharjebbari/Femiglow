import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { publishKitCompositionOverride } from '@/lib/kit/composition/store';
import {
  KIT_COMPOSITION_SUB_PRODUCT_IDS,
  type KitCompositionSubProductId,
} from '@/lib/kit/composition/types';
import { KIT_COMPOSITION_TAG } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const subId = (KIT_COMPOSITION_SUB_PRODUCT_IDS as readonly string[]).includes(params.id)
      ? (params.id as KitCompositionSubProductId)
      : null;
    if (!subId) throw new HttpError('not_found', `Sub-product inconnu : ${params.id}`);

    const published = publishKitCompositionOverride(subId);
    if (!published) {
      throw new HttpError('not_found', 'Aucun brouillon à publier.');
    }
    revalidateTag(KIT_COMPOSITION_TAG);
    await logAuditEvent({
      action: 'kit_composition.publish',
      actorId: session.adminId,
      resourceType: 'kit_composition_override',
      resourceId: published.id,
      meta: { publishedAt: published.publishedAt },
    });
    return NextResponse.json({ override: published }, { status: 200 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
