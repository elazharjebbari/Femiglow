/**
 * GET    /api/admin/coupons/[id]  → détail
 * PATCH  /api/admin/coupons/[id]  → mise à jour
 * DELETE /api/admin/coupons/[id]  → archive (soft, status=archived)
 *
 * cf. docs/coupons-qa-2026-06-02/{10,13}-*.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { requireCouponPermission } from '@/lib/coupons/permissions';
import { couponPatchSchema } from '@/lib/coupons/schemas';
import { COUPONS_TAG } from '@/lib/coupons/cache';
import { PRODUCTS_TAG } from '@/lib/products/cache';
import {
  DuplicateCouponCodeError,
  getCouponById,
  setCouponStatus,
  updateCoupon,
} from '@/lib/db/queries/coupon-repo';

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
    return NextResponse.json({ coupon });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    await requireCouponPermission('write', session);
    const { id } = await Promise.resolve(ctx.params);

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = couponPatchSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_failed', message: 'Payload invalide', details: parsed.error.issues } },
        { status: 422 },
      );
    }

    try {
      const updated = await updateCoupon(id, parsed.data);
      if (!updated) throw new HttpError('not_found', 'Coupon introuvable.');
      revalidateTag(COUPONS_TAG);
      revalidateTag(PRODUCTS_TAG);
      await logAuditEvent({
        action: 'coupons.update',
        actorId: session.adminId,
        resourceType: 'coupon',
        resourceId: id,
        meta: { fields: Object.keys(parsed.data) },
      });
      return NextResponse.json({ coupon: updated });
    } catch (e) {
      if (e instanceof DuplicateCouponCodeError) throw new HttpError('conflict', e.message);
      throw e;
    }
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    await requireCouponPermission('delete', session);
    const { id } = await Promise.resolve(ctx.params);
    const archived = await setCouponStatus(id, 'archived');
    if (!archived) throw new HttpError('not_found', 'Coupon introuvable.');
    revalidateTag(COUPONS_TAG);
    revalidateTag(PRODUCTS_TAG);
    await logAuditEvent({
      action: 'coupons.archive',
      actorId: session.adminId,
      resourceType: 'coupon',
      resourceId: id,
    });
    return NextResponse.json({ coupon: archived });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
