/**
 * GET  /api/admin/coupons       → liste (filtres status/type)
 * POST /api/admin/coupons       → création
 *
 * Ordre d'enforcement : auth → permission (403 prime) → validation (422).
 * cf. docs/coupons-qa-2026-06-02/{10,13}-*.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { requireCouponPermission } from '@/lib/coupons/permissions';
import { couponInputSchema } from '@/lib/coupons/schemas';
import { COUPONS_TAG } from '@/lib/coupons/cache';
import { PRODUCTS_TAG } from '@/lib/products/cache';
import {
  DuplicateCouponCodeError,
  createCoupon,
  listCoupons,
} from '@/lib/db/queries/coupon-repo';
import type { CouponStatus, CouponType } from '@/lib/coupons/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    await requireCouponPermission('read', session);

    const url = new URL(request.url);
    const status = (url.searchParams.get('status') as CouponStatus | null) ?? undefined;
    const type = (url.searchParams.get('type') as CouponType | null) ?? undefined;
    const items = await listCoupons({ status, type });
    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    await requireCouponPermission('write', session);

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = couponInputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'validation_failed', message: 'Payload invalide', details: parsed.error.issues } },
        { status: 422 },
      );
    }

    try {
      const created = await createCoupon(parsed.data, session.adminId);
      revalidateTag(COUPONS_TAG);
      revalidateTag(PRODUCTS_TAG); // /kit (ISR) reflète l'effet du coupon
      await logAuditEvent({
        action: 'coupons.create',
        actorId: session.adminId,
        resourceType: 'coupon',
        resourceId: created.id,
        meta: { label: created.label, type: created.type, valueAmount: created.valueAmount },
      });
      return NextResponse.json({ coupon: created }, { status: 201 });
    } catch (e) {
      if (e instanceof DuplicateCouponCodeError) {
        throw new HttpError('conflict', e.message);
      }
      throw e;
    }
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
