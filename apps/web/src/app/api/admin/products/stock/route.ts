/**
 * CHA-230 — PATCH /api/admin/products/stock
 *
 * Mutation admin sur `product_stock`. Actions :
 *   - `restock` : ajoute une réception au compteur.
 *   - `count` : remplace le compteur après un inventaire.
 *   - `increment` : ajoute (peut être négatif).
 *   - `set_threshold` : modifie `threshold_low`.
 *
 * Auth requise (admin session). Audit log via `logAuditEvent`.
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { errorResponse, mapError, zodErrorResponse } from '@/lib/checkout/api/response';
import { stockRepo, type StockChange } from '@/lib/checkout/repos/stock-repo';
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
    const { variantId, note, idempotencyKey } = input;
    const change: StockChange =
      input.action === 'count'
        ? { action: 'count', value: input.value, expectedAvailable: input.expectedAvailable }
        : input.action === 'restock'
          ? { action: 'restock', value: input.value }
          : input.action === 'set_threshold'
            ? { action: 'set_threshold', value: input.value }
            : { action: 'set_sell_when_out', value: input.value };

    const result = await stockRepo.applyChange({
      variantId,
      change,
      actorId: session.adminId,
      note,
      idempotencyKey,
    });
    if (result.outcome === 'not_found') {
      return errorResponse('not_found', 'Variant introuvable.');
    }
    if (result.outcome === 'conflict') {
      return NextResponse.json(
        {
          error: {
            code: 'stock_changed',
            message: 'Le stock a changé depuis l’ouverture de la page.',
            details: { available: result.snapshot.available },
          },
        },
        { status: 409 },
      );
    }

    const { snapshot } = result;
    const replayed = result.outcome === 'replayed';
    if (!replayed) {
      // Le compteur est déjà écrit avec son historique : un échec du journal
      // d'audit ne doit pas faire croire que la saisie a échoué.
      try {
        await logAuditEvent({
          actorId: session.adminId,
          action: 'product_stock.patch',
          resourceType: 'product_variant',
          resourceId: variantId,
          meta: {
            actorEmail: session.email,
            action: input.action,
            value: input.value,
            note,
            result: snapshot,
          },
        });
      } catch (err) {
        logger.error('admin.product.stock.audit_failed', { variantId, error: String(err) });
      }
    }
    logger.info('admin.product.stock.patched', {
      variantId,
      action: input.action,
      actorId: session.adminId,
      replayed,
    });

    return NextResponse.json(
      {
        variantId: snapshot.variantId,
        available: snapshot.available,
        reserved: snapshot.reserved,
        thresholdLow: snapshot.thresholdLow,
        sellWhenOut: snapshot.sellWhenOut,
        replayed,
      },
      { status: 200 },
    );
  } catch (err) {
    logger.error('admin.product.stock.failed', { error: String(err) });
    return mapError(err);
  }
}
