/**
 * CHA-230 — Repository product_stock.
 *
 * Lecture publique (front wizard) + mutations admin + réservation pendant
 * la finalisation d'order (Compare-And-Swap atomique).
 *
 * Concurrence :
 *   - `reserve` utilise un CAS SQL pour incrémenter `reserved` uniquement
 *     si `available - reserved >= quantity`. Retourne `null` si stock
 *     insuffisant.
 *   - `release` décrémente `reserved` (rollback après échec post-réserve).
 *   - `commit` migre `reserved` → consomme `available` (post-livraison).
 *
 * Ne jamais bypasser ce repo : c'est la source de vérité stock.
 */
import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { productStock, type ProductStockRow } from '@/lib/db/schema';

import { type StockStatus } from '../schemas/stock';

import { DbUnavailableError } from './idempotency-repo';

function requireDb(): NonNullable<ReturnType<typeof db>> {
  const conn = db();
  if (!conn) throw new DbUnavailableError();
  return conn;
}

export interface StockSnapshot {
  variantId: string;
  sku: string;
  available: number;
  reserved: number;
  thresholdLow: number;
}

/** Calcule le `StockStatus` UI à partir de l'effectif (available - reserved). */
export function computeStockStatus(snapshot: {
  available: number;
  reserved: number;
  thresholdLow: number;
}): StockStatus {
  const effective = snapshot.available - snapshot.reserved;
  if (effective <= 0) return 'out_of_stock';
  if (effective <= snapshot.thresholdLow) return 'low_stock';
  return 'in_stock';
}

/** Calcule la valeur exposable côté UI (masque le stock total). */
export function computeEffectiveDisplay(snapshot: {
  available: number;
  reserved: number;
  thresholdLow: number;
}): number {
  const effective = snapshot.available - snapshot.reserved;
  if (effective <= 0) return 0;
  if (effective <= snapshot.thresholdLow) return effective;
  return -1; // sentinel "stock confortable, valeur masquée"
}

function toSnapshot(row: ProductStockRow): StockSnapshot {
  return {
    variantId: row.variantId,
    sku: row.sku,
    available: row.available,
    reserved: row.reserved,
    thresholdLow: row.thresholdLow,
  };
}

export const stockRepo = {
  async getByVariantId(variantId: string): Promise<StockSnapshot | null> {
    const conn = requireDb();
    const rows = await conn
      .select()
      .from(productStock)
      .where(eq(productStock.variantId, variantId))
      .limit(1);
    return rows[0] ? toSnapshot(rows[0]) : null;
  },

  async getBySku(sku: string): Promise<StockSnapshot | null> {
    const conn = requireDb();
    const rows = await conn
      .select()
      .from(productStock)
      .where(eq(productStock.sku, sku))
      .limit(1);
    return rows[0] ? toSnapshot(rows[0]) : null;
  },

  /**
   * Réserve `quantity` unités atomiquement.
   *   - Conditions : `available - reserved >= quantity` (CAS).
   *   - Retourne le snapshot mis à jour, ou `null` si stock insuffisant.
   *
   * On utilise une UPDATE conditionnelle avec RETURNING qui ne renvoie
   * rien si la condition n'est pas remplie → check applicatif.
   */
  async reserve(variantId: string, quantity: number): Promise<StockSnapshot | null> {
    if (quantity <= 0) return null;
    const conn = requireDb();
    const rows = await conn
      .update(productStock)
      .set({
        reserved: sql`${productStock.reserved} + ${quantity}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productStock.variantId, variantId),
          sql`${productStock.available} - ${productStock.reserved} >= ${quantity}`,
        ),
      )
      .returning();
    return rows[0] ? toSnapshot(rows[0]) : null;
  },

  /** Libère `quantity` réservées (rollback post-réserve). */
  async release(variantId: string, quantity: number): Promise<StockSnapshot | null> {
    if (quantity <= 0) return null;
    const conn = requireDb();
    const rows = await conn
      .update(productStock)
      .set({
        reserved: sql`GREATEST(${productStock.reserved} - ${quantity}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(productStock.variantId, variantId))
      .returning();
    return rows[0] ? toSnapshot(rows[0]) : null;
  },

  /**
   * Commit final : consomme la réservation (post-livraison ou paiement
   * confirmé). Décrémente `available` ET `reserved` par `quantity`.
   */
  async commit(variantId: string, quantity: number): Promise<StockSnapshot | null> {
    if (quantity <= 0) return null;
    const conn = requireDb();
    const rows = await conn
      .update(productStock)
      .set({
        available: sql`${productStock.available} - ${quantity}`,
        reserved: sql`GREATEST(${productStock.reserved} - ${quantity}, 0)`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productStock.variantId, variantId),
          sql`${productStock.available} >= ${quantity}`,
        ),
      )
      .returning();
    return rows[0] ? toSnapshot(rows[0]) : null;
  },

  /** Mutation admin : `set` remplace `available`. */
  async setAvailable(
    variantId: string,
    value: number,
    actorId: string,
  ): Promise<StockSnapshot | null> {
    if (value < 0) return null;
    const conn = requireDb();
    const rows = await conn
      .update(productStock)
      .set({ available: value, updatedAt: new Date(), updatedBy: actorId })
      .where(eq(productStock.variantId, variantId))
      .returning();
    return rows[0] ? toSnapshot(rows[0]) : null;
  },

  /** Mutation admin : `increment` ajoute (peut être négatif). */
  async incrementAvailable(
    variantId: string,
    delta: number,
    actorId: string,
  ): Promise<StockSnapshot | null> {
    const conn = requireDb();
    const rows = await conn
      .update(productStock)
      .set({
        available: sql`GREATEST(${productStock.available} + ${delta}, 0)`,
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(productStock.variantId, variantId))
      .returning();
    return rows[0] ? toSnapshot(rows[0]) : null;
  },

  /** Mutation admin : `set_threshold` modifie threshold_low. */
  async setThreshold(
    variantId: string,
    value: number,
    actorId: string,
  ): Promise<StockSnapshot | null> {
    if (value < 0) return null;
    const conn = requireDb();
    const rows = await conn
      .update(productStock)
      .set({ thresholdLow: value, updatedAt: new Date(), updatedBy: actorId })
      .where(eq(productStock.variantId, variantId))
      .returning();
    return rows[0] ? toSnapshot(rows[0]) : null;
  },
};
