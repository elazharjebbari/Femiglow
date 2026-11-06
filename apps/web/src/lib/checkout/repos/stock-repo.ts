/**
 * CHA-230 — Repository product_stock.
 *
 * Lecture publique (front wizard) + mutations admin + réservation pendant
 * la finalisation d'order (Compare-And-Swap atomique).
 *
 * Concurrence :
 *   - `reserve` utilise un CAS SQL pour incrémenter `reserved` uniquement
 *     si `available - reserved >= quantity`, ou si `sell_when_out` est vrai.
 *     Retourne `null` si le stock est insuffisant et la vente bloquée à 0.
 *   - `release` décrémente `reserved` (rollback après échec post-réserve).
 *   - `commit` migre `reserved` → consomme `available` (post-livraison).
 *
 * Ne jamais bypasser ce repo : c'est la source de vérité stock.
 */
import { randomUUID } from 'node:crypto';

import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  orderItems,
  orders,
  products,
  productStock,
  productStockMovements,
  productVariants,
  type ProductStockRow,
} from '@/lib/db/schema';

import type { StockMovementKind, StockMovementView } from '../stock-status';

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
  sellWhenOut: boolean;
}

export type StockChange =
  | { action: 'restock'; value: number }
  | { action: 'count'; value: number; expectedAvailable: number }
  | { action: 'set_threshold'; value: number }
  | { action: 'set_sell_when_out'; value: boolean };

export type StockChangeResult =
  | { outcome: 'applied' | 'replayed'; snapshot: StockSnapshot }
  /** Inventaire refusé : le stock a bougé depuis l'affichage. */
  | { outcome: 'conflict'; snapshot: StockSnapshot }
  | { outcome: 'not_found' };

/** Calcule la valeur exposable côté UI (masque le stock total). */
export function computeEffectiveDisplay(snapshot: {
  available: number;
  reserved: number;
  thresholdLow: number;
  sellWhenOut?: boolean;
}): number {
  if (snapshot.sellWhenOut) return -1; // aucune rupture ni urgence affichée
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
    sellWhenOut: row.sellWhenOut,
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
        sellWhenOut: productStock.sellWhenOut,
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
        row.available === null ||
        row.reserved === null ||
        row.thresholdLow === null ||
        row.sellWhenOut === null
          ? null
          : {
              variantId: row.variantId,
              sku: row.sku,
              available: row.available,
              reserved: row.reserved,
              thresholdLow: row.thresholdLow,
              sellWhenOut: row.sellWhenOut,
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
          sql`(${productStock.sellWhenOut} OR ${productStock.available} - ${productStock.reserved} >= ${quantity})`,
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
          sql`(${productStock.sellWhenOut} OR ${productStock.available} >= ${quantity})`,
        ),
      )
      .returning();
    return rows[0] ? toSnapshot(rows[0]) : null;
  },

  /** Crée le compteur d'une variante qui n'en a pas (0 unité, vente ouverte). */
  async ensureRow(variantId: string, sku: string): Promise<void> {
    const conn = requireDb();
    await conn.insert(productStock).values({ variantId, sku }).onConflictDoNothing();
  },

  /**
   * Geste admin. Le compteur et sa ligne d'historique s'écrivent dans la même
   * transaction ; le verrou de ligne sérialise deux saisies et les commandes,
   * ce qui rend sûrs les contrôles d'idempotence et d'inventaire.
   */
  async applyChange(input: {
    variantId: string;
    change: StockChange;
    actorId: string;
    note?: string;
    idempotencyKey?: string;
  }): Promise<StockChangeResult> {
    const { variantId, change, actorId, note, idempotencyKey } = input;
    const conn = requireDb();
    return conn.transaction(async (tx) => {
      const variant = await tx
        .select({ sku: productVariants.sku })
        .from(productVariants)
        .where(eq(productVariants.id, variantId))
        .limit(1);
      if (!variant[0]) return { outcome: 'not_found' as const };
      await tx
        .insert(productStock)
        .values({ variantId, sku: variant[0].sku })
        .onConflictDoNothing();

      const locked = await tx
        .select()
        .from(productStock)
        .where(eq(productStock.variantId, variantId))
        .for('update');
      const row = locked[0];
      if (!row) return { outcome: 'not_found' as const };

      if (idempotencyKey) {
        const seen = await tx
          .select({ id: productStockMovements.id })
          .from(productStockMovements)
          .where(eq(productStockMovements.idempotencyKey, idempotencyKey))
          .limit(1);
        if (seen[0]) return { outcome: 'replayed' as const, snapshot: toSnapshot(row) };
      }

      if (change.action === 'count' && change.expectedAvailable !== row.available) {
        return { outcome: 'conflict' as const, snapshot: toSnapshot(row) };
      }

      const nextAvailable =
        change.action === 'restock'
          ? row.available + change.value
          : change.action === 'count'
            ? change.value
            : row.available;
      const kind: StockMovementKind =
        change.action === 'restock'
          ? 'restock'
          : change.action === 'count'
            ? 'count'
            : change.action === 'set_threshold'
              ? 'threshold'
              : 'policy';

      const updated = await tx
        .update(productStock)
        .set({
          available: nextAvailable,
          ...(change.action === 'set_threshold' ? { thresholdLow: change.value } : {}),
          ...(change.action === 'set_sell_when_out' ? { sellWhenOut: change.value } : {}),
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .where(eq(productStock.variantId, variantId))
        .returning();
      await tx.insert(productStockMovements).values({
        id: `psm_${randomUUID()}`,
        variantId,
        kind,
        delta: nextAvailable - row.available,
        availableAfter: nextAvailable,
        note: note ?? null,
        actorId,
        idempotencyKey: idempotencyKey ?? null,
      });
      return { outcome: 'applied' as const, snapshot: toSnapshot(updated[0] as ProductStockRow) };
    });
  },

  async listMovements(variantIds: string[], limit = 8): Promise<Map<string, StockMovementView[]>> {
    const byVariant = new Map<string, StockMovementView[]>();
    if (variantIds.length === 0) return byVariant;
    const conn = requireDb();
    const rows = await conn
      .select()
      .from(productStockMovements)
      .where(inArray(productStockMovements.variantId, variantIds))
      .orderBy(desc(productStockMovements.createdAt));
    for (const row of rows) {
      const list = byVariant.get(row.variantId) ?? [];
      if (list.length >= limit) continue;
      list.push({
        id: row.id,
        kind: row.kind as StockMovementKind,
        delta: row.delta,
        availableAfter: row.availableAfter,
        note: row.note,
        createdAt: row.createdAt.toISOString(),
      });
      byVariant.set(row.variantId, list);
    }
    return byVariant;
  },

  /** Unités commandées par SKU depuis `since`, pour estimer le rythme. */
  async soldSince(skus: string[], since: Date): Promise<Map<string, number>> {
    const sold = new Map<string, number>();
    if (skus.length === 0) return sold;
    const conn = requireDb();
    const rows = await conn
      .select({
        sku: orderItems.sku,
        units: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(inArray(orderItems.sku, skus), gte(orders.createdAt, since)))
      .groupBy(orderItems.sku);
    for (const row of rows) sold.set(row.sku, Number(row.units));
    return sold;
  },
};
