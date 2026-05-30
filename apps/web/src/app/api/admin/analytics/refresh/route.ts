/**
 * POST /api/admin/analytics/refresh — refresh manuel des stats analytics
 * (Funnel / CTA / Checkout).
 *
 * Vide le **snapshot en mémoire** des longues fenêtres (≥ 30 j, mises en cache
 * par défaut) puis rafraîchit les **matviews DB**. Les chiffres restent exacts ;
 * ce bouton permet à l'opérateur d'obtenir des stats actualisées à la demande.
 *
 * Auth : iron-session (admin) OU Bearer ${CRON_SECRET} (cron Vercel).
 * cf. docs/analytics-audit-qa-2026-05-30 (approche snapshot + refresh manuel).
 */
import { NextResponse } from 'next/server';

import { clearAnalyticsCache } from '@/lib/analytics/cache';
import { refreshAllMatviews } from '@/lib/analytics/matviews';
import { getAdminSession } from '@/lib/auth/require-admin';
import { env } from '@/lib/env';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = request.headers.get('authorization');
    const expected = env.CRON_SECRET ? `Bearer ${env.CRON_SECRET}` : null;
    const isCron = expected !== null && auth === expected;
    if (!isCron) {
      const session = await getAdminSession();
      if (!session) throw new HttpError('unauthorized', 'Session admin requise');
    }

    // 1) Vide le snapshot mémoire (longues fenêtres) → recalcul frais au prochain chargement.
    clearAnalyticsCache();
    // 2) Rafraîchit les matviews DB (refreshAllMatviews ne throw jamais : ok=false
    //    si la base ou les vues sont absentes — le vidage du cache suffit alors).
    const matviews = (await refreshAllMatviews()).map((r) => ({ view: r.view, ok: r.ok }));

    return NextResponse.json(
      { ok: true, cacheCleared: true, matviews },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
