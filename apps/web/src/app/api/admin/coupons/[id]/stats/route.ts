/**
 * GET /api/admin/coupons/[id]/stats → agrégats d'incrémentalité (treatment vs
 * holdout) + uplift. Lecture seule. cf. CPN-12.
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { requireCouponPermission } from '@/lib/coupons/permissions';
import { computeCouponStats } from '@/lib/coupons/stats';
import { countByPhaseAndBucket } from '@/lib/db/queries/coupon-event-repo';
import { getCouponById } from '@/lib/db/queries/coupon-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> | { id: string } };

export async function GET(_request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    await requireCouponPermission('read', session);
    const { id } = await Promise.resolve(ctx.params);

    const coupon = await getCouponById(id);
    if (!coupon) throw new HttpError('not_found', 'Coupon introuvable.');

    const counts = await countByPhaseAndBucket(id);
    const stats = computeCouponStats(counts);
    return NextResponse.json({ couponId: id, stats });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
