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
} from '@/lib/checkout/stock-status';
import { logger } from '@/lib/logging/logger';

export interface VariantStockRead {
  byVariantId: Record<string, AdminStockView>;
  readable: boolean;
}

export interface PublishedStockAlertsRead {
  alerts: StockAlert[];
  readable: boolean;
}

export async function loadVariantStock(variantIds: string[]): Promise<VariantStockRead> {
  try {
    const snapshots = await stockRepo.listByVariantIds(variantIds);
    const byVariantId: Record<string, AdminStockView> = {};
    for (const snapshot of snapshots) {
      byVariantId[snapshot.variantId] = toAdminStockView(snapshot);
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
    const alerts = buildStockAlerts(
      rows.map((row) => ({
        ...row,
        stock: row.stock ? toAdminStockView(row.stock) : null,
      })),
    );
    return { alerts, readable: true };
  } catch (err) {
    logger.error('admin.products.stock_alerts.read_failed', { error: String(err) });
    return { alerts: [], readable: false };
  }
}
