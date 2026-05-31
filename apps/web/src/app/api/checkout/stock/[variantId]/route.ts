/**
 * CHA-230 — GET /api/checkout/stock/[variantId]
 *
 * Lecture publique non sensible — expose un `effectiveDisplay` borné
 * pour ne pas révéler le stock total exact (concurrence).
 *
 * Cache : `s-maxage=10, stale-while-revalidate=30` (10s frais, 30s SWR).
 */
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logging/logger';
import { errorResponse, mapError } from '@/lib/checkout/api/response';
import {
  computeEffectiveDisplay,
  computeStockStatus,
  stockRepo,
} from '@/lib/checkout/repos/stock-repo';
import type { GetStockResponse } from '@/lib/checkout/schemas/stock';

export const runtime = 'nodejs';
export const revalidate = 10;

export async function GET(
  _req: Request,
  context: { params: { variantId: string } },
): Promise<Response> {
  const variantId = context.params.variantId;
  if (!variantId || variantId.length < 4) {
    return errorResponse('invalid_input', 'variantId invalide.');
  }

  try {
    const snapshot = await stockRepo.getByVariantId(variantId);
    if (!snapshot) return errorResponse('not_found', 'Variant introuvable.');
    const payload: GetStockResponse = {
      variantId: snapshot.variantId,
      sku: snapshot.sku,
      status: computeStockStatus(snapshot),
      effectiveDisplay: computeEffectiveDisplay(snapshot),
      thresholdLow: snapshot.thresholdLow,
    };
    const res = NextResponse.json(payload, { status: 200 });
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=10, stale-while-revalidate=30',
    );
    return res;
  } catch (err) {
    logger.error('checkout.stock.get.failed', { variantId, error: String(err) });
    return mapError(err);
  }
}
