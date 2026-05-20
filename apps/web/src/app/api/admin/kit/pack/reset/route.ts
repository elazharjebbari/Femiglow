/**
 * POST /api/admin/kit/pack/reset
 *
 * Supprime totalement l'override pack — la section revient au mock.
 * Idempotent — un reset sans override est un no-op qui retourne 200.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { KIT_PACK_TAG } from '@/lib/kit/pack/resolver';
import { getKitPackOverride, resetKitPackOverride } from '@/lib/kit/pack/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const before = getKitPackOverride();
    resetKitPackOverride();
    if (before) {
      revalidateTag(KIT_PACK_TAG);
      await logAuditEvent({
        action: 'kit_pack.reset',
        actorId: session.adminId,
        resourceType: 'kit_pack_override',
        resourceId: before.id,
        meta: { hadPublished: before.publishedAt !== null },
      });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
