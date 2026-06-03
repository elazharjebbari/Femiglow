/**
 * POST /api/coupons/redeem — VALIDE (sans consommer) un code de crédit
 * fidélité (Phase 3) pour prévisualiser la réduction côté client. La
 * consommation réelle a lieu à la création de la commande (autoritaire).
 *
 * Body : { code: string }
 * Réponse : { valid: boolean, valueCents?: number, reason?: string }
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
    const { validateGrant } = await import('@/lib/db/queries/coupon-grant-repo');
    const check = await validateGrant(parsed.data.code);
    if (!check.valid) {
      return NextResponse.json({ valid: false, reason: check.reason });
    }
    return NextResponse.json({ valid: true, valueCents: check.valueCents });
  } catch {
    return NextResponse.json({ valid: false, reason: 'error' });
  }
}
