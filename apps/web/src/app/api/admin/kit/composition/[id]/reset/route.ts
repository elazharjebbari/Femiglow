import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import {
  getKitCompositionOverride,
  resetKitCompositionOverride,
} from '@/lib/kit/composition/store';
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

    const existing = getKitCompositionOverride(subId);
    resetKitCompositionOverride(subId);
    revalidateTag(KIT_COMPOSITION_TAG);
    await logAuditEvent({
      action: 'kit_composition.reset',
      actorId: session.adminId,
      resourceType: 'kit_composition_override',
      resourceId: existing?.id ?? null,
      meta: { hadOverride: existing !== null },
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
