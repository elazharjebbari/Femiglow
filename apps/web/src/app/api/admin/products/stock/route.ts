/**
 * CHA-230 — PATCH /api/admin/products/stock
 *
 * Mutation admin sur `product_stock`. Actions :
 *   - `set` : remplace `available` par la valeur.
 *   - `increment` : ajoute (peut être négatif).
 *   - `set_threshold` : modifie `threshold_low`.
 *
 * Auth requise (admin session). Audit log via `logAuditEvent`.
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { errorResponse, mapError, zodErrorResponse } from '@/lib/checkout/api/response';
import { stockRepo } from '@/lib/checkout/repos/stock-repo';
import { patchAdminStockInputSchema } from '@/lib/checkout/schemas/stock';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request): Promise<Response> {
  const session = await getAdminSession();
  if (!session) return errorResponse('not_found', 'Endpoint non disponible.');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('invalid_json', 'JSON invalide.');
  }

  const parsed = patchAdminStockInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const input = parsed.data;

  try {
    let snapshot:
      | Awaited<ReturnType<typeof stockRepo.setAvailable>>
      | null = null;
    switch (input.action) {
      case 'set':
        snapshot = await stockRepo.setAvailable(
          input.variantId,
          input.value,
          session.adminId,
        );
        break;
      case 'increment':
        snapshot = await stockRepo.incrementAvailable(
          input.variantId,
          input.value,
          session.adminId,
        );
        break;
      case 'set_threshold':
        snapshot = await stockRepo.setThreshold(
          input.variantId,
          input.value,
          session.adminId,
        );
        break;
    }
    if (!snapshot) return errorResponse('not_found', 'Variant introuvable.');

    await logAuditEvent({
      actorId: session.adminId,
      action: 'product_stock.patch',
      resourceType: 'product_variant',
      resourceId: input.variantId,
      meta: {
        actorEmail: session.email,
        action: input.action,
        value: input.value,
        note: input.note,
        result: snapshot,
      },
    });
    logger.info('admin.product.stock.patched', {
      variantId: input.variantId,
      action: input.action,
      actorId: session.adminId,
    });

    return NextResponse.json(
      {
        variantId: snapshot.variantId,
        available: snapshot.available,
        reserved: snapshot.reserved,
        thresholdLow: snapshot.thresholdLow,
      },
      { status: 200 },
    );
  } catch (err) {
    logger.error('admin.product.stock.failed', { error: String(err) });
    return mapError(err);
  }
}
