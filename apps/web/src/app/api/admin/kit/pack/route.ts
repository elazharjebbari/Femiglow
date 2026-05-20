/**
 * GET   /api/admin/kit/pack → renvoie l'override courant + source.
 * PATCH /api/admin/kit/pack → patch partiel (save brouillon).
 *
 * Auth admin obligatoire. Audit log à chaque mutation.
 * Revalidation `kit-pack` à chaque écriture.
 *
 * Cf. `docs/pack-section-optim-2026-05/04-backend-design.md`.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { KIT_PACK_TAG } from '@/lib/kit/pack/resolver';
import { kitPackOverrideUpsertSchema } from '@/lib/kit/pack/schemas';
import { getKitPackOverride, upsertKitPackOverride } from '@/lib/kit/pack/store';
import type { KitPackSource } from '@/lib/kit/pack/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function deriveSource(): KitPackSource {
  const o = getKitPackOverride();
  if (!o) return 'mock';
  return o.publishedAt !== null ? 'override-published' : 'override-draft';
}

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const override = getKitPackOverride();
    return NextResponse.json({ override, source: deriveSource() });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = kitPackOverrideUpsertSchema.safeParse(body);
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
    const saved = upsertKitPackOverride(parsed.data, { actorId: session.adminId });
    revalidateTag(KIT_PACK_TAG);
    await logAuditEvent({
      action: 'kit_pack.update',
      actorId: session.adminId,
      resourceType: 'kit_pack_override',
      resourceId: saved.id,
      meta: { patchKeys: Object.keys(parsed.data) },
    });
    return NextResponse.json(
      { override: saved, source: deriveSource() },
      { status: 200 },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
