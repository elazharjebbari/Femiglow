/**
 * POST /api/admin/coupons/[id]/status → transition de statut.
 *
 * Effet immédiat sur /kit via revalidateTag(coupons). Permission `publish`
 * (activer/pauser = acte de mise en ligne). cf. CPN-11.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { requireCouponPermission } from '@/lib/coupons/permissions';
import { couponStatusActionSchema } from '@/lib/coupons/schemas';
import { COUPONS_TAG } from '@/lib/coupons/cache';
import { PRODUCTS_TAG } from '@/lib/products/cache';
import { getCouponById, setCouponStatus } from '@/lib/db/queries/coupon-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> | { id: string } };

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    await requireCouponPermission('publish', session);
    const { id } = await Promise.resolve(ctx.params);

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = couponStatusActionSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_failed', message: 'Statut invalide', details: parsed.error.issues } },
        { status: 422 },
      );
    }

    const current = await getCouponById(id);
    if (!current) throw new HttpError('not_found', 'Coupon introuvable.');
    if (current.status === 'archived' && parsed.data.status !== 'archived') {
      throw new HttpError('conflict', 'Un coupon archivé ne peut pas être réactivé.');
    }

    const updated = await setCouponStatus(id, parsed.data.status);
    revalidateTag(COUPONS_TAG);
    revalidateTag(PRODUCTS_TAG); // /kit (ISR) reflète l'activation/pause
    await logAuditEvent({
      action: 'coupons.status',
      actorId: session.adminId,
      resourceType: 'coupon',
      resourceId: id,
      meta: { from: current.status, to: parsed.data.status },
    });
    return NextResponse.json({ coupon: updated });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
