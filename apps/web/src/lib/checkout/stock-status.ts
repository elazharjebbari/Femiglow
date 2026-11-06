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
  /** À 0, les commandes passent et le stock devient négatif. */
  sellWhenOut?: boolean;
}

export type StockMovementKind = 'restock' | 'count' | 'threshold' | 'policy';

export interface StockMovementView {
  id: string;
  kind: StockMovementKind;
  delta: number;
  availableAfter: number;
  note: string | null;
  createdAt: string;
}

/** Vue admin d'un compteur : valeurs exactes, jamais exposées au public. */
export interface AdminStockView extends StockCounter {
  variantId: string;
  sku: string;
  /** `available - reserved`. Négatif : commandes à couvrir. */
  effective: number;
  status: StockStatus;
  sellWhenOut: boolean;
  /** Unités commandées sur 7 jours ; `null` si la mesure est indisponible. */
  soldLast7Days: number | null;
  /** Jours avant d'atteindre 0 au rythme des 7 derniers jours. */
  daysLeft: number | null;
  movements: StockMovementView[];
}

/** Calcule le `StockStatus` UI à partir de l'effectif (available - reserved). */
export function computeStockStatus(snapshot: StockCounter): StockStatus {
  const effective = snapshot.available - snapshot.reserved;
  if (effective <= 0) return 'out_of_stock';
  if (effective <= snapshot.thresholdLow) return 'low_stock';
  return 'in_stock';
}

/**
 * Statut montré à la cliente. Quand la vente continue à 0, ni rupture ni
 * « il n'en reste que X » : le compteur suit les commandes, pas les colis.
 */
export function computePublicStockStatus(snapshot: StockCounter): StockStatus {
  return snapshot.sellWhenOut ? 'in_stock' : computeStockStatus(snapshot);
}

export function estimateDaysLeft(effective: number, soldLast7Days: number | null): number | null {
  if (soldLast7Days === null || soldLast7Days <= 0) return null;
  if (effective <= 0) return 0;
  return Math.floor(effective / (soldLast7Days / 7));
}

export function toAdminStockView(
  snapshot: StockCounter & { variantId: string; sku: string },
  extra: { soldLast7Days?: number | null; movements?: StockMovementView[] } = {},
): AdminStockView {
  const effective = snapshot.available - snapshot.reserved;
  const soldLast7Days = extra.soldLast7Days ?? null;
  return {
    variantId: snapshot.variantId,
    sku: snapshot.sku,
    available: snapshot.available,
    reserved: snapshot.reserved,
    thresholdLow: snapshot.thresholdLow,
    effective,
    status: computeStockStatus(snapshot),
    sellWhenOut: snapshot.sellWhenOut ?? false,
    soldLast7Days,
    daysLeft: estimateDaysLeft(effective, soldLast7Days),
    movements: extra.movements ?? [],
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
  /**
   * `refused` : `order-repo` rejette les commandes de cette variante.
   * `oversold` : stock à 0 ou négatif, les ventes continuent.
   * `low` : seuil atteint, ou moins de 7 jours au rythme actuel.
   */
  level: 'refused' | 'oversold' | 'low';
  /** `null` si la variante n'a aucun compteur. */
  effective: number | null;
  thresholdLow: number | null;
  daysLeft: number | null;
}

/** En deçà, le bandeau prévient : le temps de recevoir une livraison. */
const LOW_DAYS_LEFT = 7;

/**
 * Une variante sans compteur est aussi refusée : la réservation ne trouve
 * aucune ligne à mettre à jour et `order-repo` lève `StockInsufficientError`.
 */
export function buildStockAlerts(entries: StockAlertInput[]): StockAlert[] {
  const alerts: StockAlert[] = [];
  for (const { stock, ...identity } of entries) {
    if (!stock) {
      alerts.push({
        ...identity,
        level: 'refused',
        effective: null,
        thresholdLow: null,
        daysLeft: null,
      });
      continue;
    }
    const lowDays = stock.daysLeft !== null && stock.daysLeft <= LOW_DAYS_LEFT;
    if (stock.status === 'in_stock' && !lowDays) continue;
    const level =
      stock.status !== 'out_of_stock' ? 'low' : stock.sellWhenOut ? 'oversold' : 'refused';
    alerts.push({
      ...identity,
      level,
      effective: stock.effective,
      thresholdLow: stock.thresholdLow,
      daysLeft: stock.daysLeft,
    });
  }
  return alerts;
}
