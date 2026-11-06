/**
 * Calculs purs sur le compteur `product_stock`, sans accès base : ce module
 * est importable depuis un composant client. Source unique du statut pour le
 * tunnel public (via `stock-repo`) et pour l'admin.
 */
import type { StockStatus } from './schemas/stock';

export interface StockCounter {
  available: number;
  reserved: number;
  thresholdLow: number;
}

/** Vue admin d'un compteur : valeurs exactes, jamais exposées au public. */
export interface AdminStockView extends StockCounter {
  variantId: string;
  sku: string;
  /** `available - reserved`. Peut être négatif si `available` < `reserved`. */
  effective: number;
  status: StockStatus;
}

/** Calcule le `StockStatus` UI à partir de l'effectif (available - reserved). */
export function computeStockStatus(snapshot: StockCounter): StockStatus {
  const effective = snapshot.available - snapshot.reserved;
  if (effective <= 0) return 'out_of_stock';
  if (effective <= snapshot.thresholdLow) return 'low_stock';
  return 'in_stock';
}

export function toAdminStockView(
  snapshot: StockCounter & { variantId: string; sku: string },
): AdminStockView {
  return {
    variantId: snapshot.variantId,
    sku: snapshot.sku,
    available: snapshot.available,
    reserved: snapshot.reserved,
    thresholdLow: snapshot.thresholdLow,
    effective: snapshot.available - snapshot.reserved,
    status: computeStockStatus(snapshot),
  };
}

export interface StockAlertInput {
  sku: string;
  label: string;
  /** `null` : aucune ligne `product_stock` pour cette variante. */
  stock: AdminStockView | null;
  productSlug?: string;
  productTitle?: string;
}

export interface StockAlert extends Omit<StockAlertInput, 'stock'> {
  /** `refused` : `order-repo` rejette toute commande de cette variante. */
  level: 'refused' | 'low';
  /** `null` si la variante n'a aucun compteur. */
  effective: number | null;
  thresholdLow: number | null;
}

/**
 * Une variante sans compteur est aussi refusée : la réservation ne trouve
 * aucune ligne à mettre à jour et `order-repo` lève `StockInsufficientError`.
 */
export function buildStockAlerts(entries: StockAlertInput[]): StockAlert[] {
  const alerts: StockAlert[] = [];
  for (const { stock, ...identity } of entries) {
    if (!stock) {
      alerts.push({ ...identity, level: 'refused', effective: null, thresholdLow: null });
      continue;
    }
    if (stock.status === 'in_stock') continue;
    alerts.push({
      ...identity,
      level: stock.status === 'out_of_stock' ? 'refused' : 'low',
      effective: stock.effective,
      thresholdLow: stock.thresholdLow,
    });
  }
  return alerts;
}
