/**
 * CHA-230 — POST /api/checkout/stock-notify
 *
 * Opt-in back-in-stock : l'utilisateur s'abonne aux alertes de retour
 * en stock pour un variant. Stocke (email|phone, variantId, visitorId)
 * dans un store léger côté tracking event log pour relance.
 *
 * Pas d'idempotence stricte — un même utilisateur peut s'abonner
 * plusieurs fois (déduplication via le store en aval).
 */
import { type NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logging/logger';
import { errorResponse, mapError, zodErrorResponse } from '@/lib/checkout/api/response';
import { stockRepo } from '@/lib/checkout/repos/stock-repo';
import { stockNotifyInputSchema } from '@/lib/checkout/schemas/stock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'JSON invalide.');
  }

  const parsed = stockNotifyInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const input = parsed.data;

  try {
    const snapshot = await stockRepo.getByVariantId(input.variantId);
    if (!snapshot) return errorResponse('not_found', 'Variant introuvable.');

    // V1 : on log seulement — la file d'envoi sera branchée sur un
    // worker dédié (cf. CHA-235 — pas couvert par ce ticket).
    logger.info('checkout.stock-notify.subscribed', {
      variantId: input.variantId,
      hasEmail: Boolean(input.email),
      hasPhone: Boolean(input.phone),
      visitorId: input.visitorId,
    });

    return NextResponse.json({ status: 'subscribed' as const }, { status: 201 });
  } catch (err) {
    logger.error('checkout.stock-notify.failed', { error: String(err) });
    return mapError(err);
  }
}
