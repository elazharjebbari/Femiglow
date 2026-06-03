/**
 * GET /api/admin/coupons/grants — liste des codes de fidélité émis (Phase 3).
 * Filtres : ?phone=&status=. Auth + RBAC `coupons:read`. Téléphone MASQUÉ.
 * cf. docs/promo-code-loyalty-2026-06-03.
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { requireCouponPermission } from '@/lib/coupons/permissions';
import { listGrants, maskPhone } from '@/lib/db/queries/coupon-grant-repo';
import type { GrantStatus } from '@/lib/db/queries/coupon-grant-repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    await requireCouponPermission('read', session);

    const url = new URL(request.url);
    const phone = url.searchParams.get('phone')?.trim() || undefined;
    const status = (url.searchParams.get('status') as GrantStatus | null) ?? undefined;

    const grants = await listGrants({ phoneE164: phone, status });
    // Sérialisation : téléphone masqué (PII), dates ISO.
    const items = grants.map((g) => ({
      id: g.id,
      code: g.code,
      phone: maskPhone(g.phoneE164),
      valueCents: g.valueCents,
      currency: g.currency,
      status: g.status,
      activatesAt: g.activatesAt ? new Date(g.activatesAt).toISOString() : null,
      expiresAt: g.expiresAt ? new Date(g.expiresAt).toISOString() : null,
      sourceOrderId: g.sourceOrderId,
      redeemedOrderId: g.redeemedOrderId,
      createdAt: new Date(g.createdAt).toISOString(),
    }));
    return NextResponse.json({ items, total: items.length });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
