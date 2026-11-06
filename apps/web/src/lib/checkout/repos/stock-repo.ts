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
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  products,
  productStock,
  productVariants,
  type ProductStockRow,
} from '@/lib/db/schema';

import { DbUnavailableError } from './idempotency-repo';

export { computeStockStatus } from '../stock-status';

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

/** Variante d'un produit publié, avec son compteur s'il existe. */
export interface PublishedVariantStock {
  productSlug: string;
  productTitle: string;
  sku: string;
  label: string;
  stock: StockSnapshot | null;
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

  /** Lecture admin : les variantes sans compteur sont absentes du résultat. */
  async listByVariantIds(variantIds: string[]): Promise<StockSnapshot[]> {
    if (variantIds.length === 0) return [];
    const conn = requireDb();
    const rows = await conn
      .select()
      .from(productStock)
      .where(inArray(productStock.variantId, variantIds));
    return rows.map(toSnapshot);
  },

  /** Lecture admin : LEFT JOIN pour faire remonter les variantes sans compteur. */
  async listPublishedVariants(): Promise<PublishedVariantStock[]> {
    const conn = requireDb();
    const rows = await conn
      .select({
        productSlug: products.slug,
        productTitle: products.title,
        variantId: productVariants.id,
        sku: productVariants.sku,
        label: productVariants.label,
        available: productStock.available,
        reserved: productStock.reserved,
        thresholdLow: productStock.thresholdLow,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .leftJoin(productStock, eq(productStock.variantId, productVariants.id))
      .where(eq(products.status, 'published'))
      .orderBy(asc(products.position), asc(productVariants.position));
    return rows.map((row) => ({
      productSlug: row.productSlug,
      productTitle: row.productTitle,
      sku: row.sku,
      label: row.label,
      stock:
        row.available === null || row.reserved === null || row.thresholdLow === null
          ? null
          : {
              variantId: row.variantId,
              sku: row.sku,
              available: row.available,
              reserved: row.reserved,
              thresholdLow: row.thresholdLow,
            },
    }));
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
