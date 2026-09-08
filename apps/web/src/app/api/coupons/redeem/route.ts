/**
 * POST /api/coupons/redeem — VALIDE (sans consommer) un code saisi par la
 * cliente pour prévisualiser la réduction côté client :
 *  - crédit de fidélité (Phase 3, codes « FG-… », `coupon_grants`) ;
 *  - code promo marketing (`coupons.mode='code'`, ex. « GLOW99 » d'une
 *    campagne Meta).
 * La consommation réelle a lieu à la création de la commande (autoritaire).
 *
 * Body : { code: string }
 * Réponse : { valid: true, valueCents, kind: 'credit'|'promo', label? }
 *         | { valid: false, reason }
 * Publique, best-effort. cf. docs/coupons-qa-2026-06-02 (Phase 3).
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ code: z.string().trim().min(3).max(40) });

export async function POST(req: NextRequest): Promise<Response> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ valid: false, reason: 'invalid_input' }, { status: 422 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ valid: false, reason: 'invalid_input' }, { status: 422 });
  }

  try {
    const { resolveRedeemableCode } = await import('@/lib/coupons/promo-code');
    const check = await resolveRedeemableCode(parsed.data.code);
    if (!check.valid) {
      return NextResponse.json({ valid: false, reason: check.reason });
    }
    if (check.kind === 'promo') {
      return NextResponse.json({
        valid: true,
        valueCents: check.valueCents,
        kind: 'promo',
        code: check.code,
        label: check.coupon.label,
      });
    }
    return NextResponse.json({ valid: true, valueCents: check.valueCents, kind: 'credit' });
  } catch {
    return NextResponse.json({ valid: false, reason: 'error' });
  }
}
