/**
 * GET   /api/admin/kit/composition/[id] → override + résolu draft.
 * PATCH /api/admin/kit/composition/[id] → patch partiel (save brouillon).
 *
 * `[id]` doit être ∈ KIT_COMPOSITION_SUB_PRODUCT_IDS, sinon 404.
 *
 * Auth admin obligatoire. Audit log. Revalidation `kit-composition`.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { kitCompositionOverrideUpsertSchema } from '@/lib/kit/composition/schemas';
import { resolveKitCompositionItemDraft } from '@/lib/kit/composition/resolver';
import {
  getKitCompositionOverride,
  upsertKitCompositionOverride,
} from '@/lib/kit/composition/store';
import {
  KIT_COMPOSITION_SUB_PRODUCT_IDS,
  type KitCompositionSubProductId,
} from '@/lib/kit/composition/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const KIT_COMPOSITION_TAG = 'kit-composition';

function parseSubProductId(raw: string): KitCompositionSubProductId | null {
  return (KIT_COMPOSITION_SUB_PRODUCT_IDS as readonly string[]).includes(raw)
    ? (raw as KitCompositionSubProductId)
    : null;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const subId = parseSubProductId(params.id);
    if (!subId) throw new HttpError('not_found', `Sub-product inconnu : ${params.id}`);

    const override = getKitCompositionOverride(subId);
    const resolved = resolveKitCompositionItemDraft(subId);
    return NextResponse.json({ override, resolved });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const subId = parseSubProductId(params.id);
    if (!subId) throw new HttpError('not_found', `Sub-product inconnu : ${params.id}`);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = kitCompositionOverrideUpsertSchema.safeParse({
      ...(typeof body === 'object' && body !== null ? body : {}),
      subProductId: subId,
    });
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
    const saved = upsertKitCompositionOverride(parsed.data, {
      actorId: session.adminId,
    });
    revalidateTag(KIT_COMPOSITION_TAG);
    await logAuditEvent({
      action: 'kit_composition.update',
      actorId: session.adminId,
      resourceType: 'kit_composition_override',
      resourceId: saved.id,
      meta: { patchKeys: Object.keys(parsed.data).filter((k) => k !== 'subProductId') },
    });
    return NextResponse.json({ override: saved }, { status: 200 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
