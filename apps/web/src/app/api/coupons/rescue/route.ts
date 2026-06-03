/**
 * POST /api/coupons/rescue — résolution server-side de l'offre de sauvetage
 * (Phase 2). Appelée par le client APRÈS le signal d'engagement (exit-intent /
 * scroll profond, visiteur non converti).
 *
 * Le serveur (autoritaire) décide du bucket à partir du contexte (cookie),
 * journalise un événement `exposed` (treatment ET holdout, pour des
 * dénominateurs comparables), et renvoie `show` = (bucket === treatment).
 * AUCUN effet sur le prix : l'avantage est non monétaire (cadeau).
 *
 * Publique (pas d'auth), best-effort : un échec de log ne bloque jamais la
 * réponse. cf. docs/coupons-qa-2026-06-02 + Phase 2.
 */
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { buildCouponContext } = await import('@/lib/coupons/context');
    const { resolveRescueCoupon } = await import('@/lib/coupons/engine');

    const ctx = buildCouponContext({
      referer: req.headers.get('referer'),
      userAgent: req.headers.get('user-agent'),
      sessionId:
        req.cookies.get('fg_session_id')?.value ?? req.cookies.get('_fbp')?.value ?? null,
    });

    const resolved = await resolveRescueCoupon(ctx);
    if (!resolved) {
      return NextResponse.json({ show: false });
    }

    // Journalise l'exposition (treatment + holdout) — best-effort.
    try {
      const { recordCouponEvent } = await import('@/lib/db/queries/coupon-event-repo');
      await recordCouponEvent({
        couponId: resolved.coupon.id,
        phase: 'exposed',
        bucket: resolved.bucket,
        visitorKey: ctx.visitorKey ?? null,
        trafficSource: ctx.trafficSource ?? null,
        device: ctx.device ?? null,
      });
    } catch {
      /* non bloquant */
    }

    return NextResponse.json({ show: resolved.bucket === 'treatment' });
  } catch {
    // Jamais d'erreur visible côté visiteur : pas d'offre.
    return NextResponse.json({ show: false });
  }
}
