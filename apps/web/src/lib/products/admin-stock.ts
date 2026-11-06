/**
 * Lecture du compteur `product_stock` pour les pages admin produits.
 *
 * Un échec de lecture ne casse pas la page : il remonte en `readable: false`
 * pour que l'admin voie « stock illisible » et non un stock supposé correct.
 */
import 'server-only';

import { stockRepo } from '@/lib/checkout/repos/stock-repo';
import {
  buildStockAlerts,
  toAdminStockView,
  type AdminStockView,
  type StockAlert,
  type StockMovementView,
} from '@/lib/checkout/stock-status';
import { logger } from '@/lib/logging/logger';
import type { ProductStockSummary } from '@/lib/products/stock-summary';

export interface VariantStockRead {
  byVariantId: Record<string, AdminStockView>;
  readable: boolean;
}

export interface PublishedStockAlertsRead {
  alerts: StockAlert[];
  /** Stock du produit par slug : somme des variantes, pour la liste admin. */
  summaryBySlug: Record<string, ProductStockSummary>;
  readable: boolean;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Le rythme de vente est un plus : son échec ne cache pas le stock. */
async function soldLastWeek(skus: string[]): Promise<Map<string, number> | null> {
  try {
    return await stockRepo.soldSince(skus, new Date(Date.now() - WEEK_MS));
  } catch (err) {
    logger.error('admin.product.stock.sales_failed', { error: String(err) });
    return null;
  }
}

export async function loadVariantStock(variantIds: string[]): Promise<VariantStockRead> {
  try {
    const snapshots = await stockRepo.listByVariantIds(variantIds);
    const [sold, movements] = await Promise.all([
      soldLastWeek(snapshots.map((s) => s.sku)),
      stockRepo.listMovements(variantIds).catch((err: unknown) => {
        logger.error('admin.product.stock.movements_failed', { error: String(err) });
        return new Map<string, StockMovementView[]>();
      }),
    ]);
    const byVariantId: Record<string, AdminStockView> = {};
    for (const snapshot of snapshots) {
      byVariantId[snapshot.variantId] = toAdminStockView(snapshot, {
        soldLast7Days: sold ? (sold.get(snapshot.sku) ?? 0) : null,
        movements: movements.get(snapshot.variantId) ?? [],
      });
    }
    return { byVariantId, readable: true };
  } catch (err) {
    logger.error('admin.product.stock.read_failed', { error: String(err) });
    return { byVariantId: {}, readable: false };
  }
}

export async function loadPublishedStockAlerts(): Promise<PublishedStockAlertsRead> {
  try {
    const rows = await stockRepo.listPublishedVariants();
    const sold = await soldLastWeek(rows.map((row) => row.sku));
    const entries = rows.map((row) => ({
      ...row,
      stock: row.stock
        ? toAdminStockView(row.stock, {
            soldLast7Days: sold ? (sold.get(row.sku) ?? 0) : null,
          })
        : null,
    }));
    const summaryBySlug: Record<string, ProductStockSummary> = {};
    for (const { productSlug, stock } of entries) {
      if (!stock) continue;
      const known = summaryBySlug[productSlug];
      const daysLeft =
        known && known.daysLeft !== null && stock.daysLeft !== null
          ? Math.min(known.daysLeft, stock.daysLeft)
          : (known?.daysLeft ?? stock.daysLeft);
      summaryBySlug[productSlug] = {
        effective: (known?.effective ?? 0) + stock.effective,
        daysLeft,
        sellWhenOut: (known?.sellWhenOut ?? true) && stock.sellWhenOut,
      };
    }
    return { alerts: buildStockAlerts(entries), summaryBySlug, readable: true };
  } catch (err) {
    logger.error('admin.products.stock_alerts.read_failed', { error: String(err) });
    return { alerts: [], summaryBySlug: {}, readable: false };
  }
}
