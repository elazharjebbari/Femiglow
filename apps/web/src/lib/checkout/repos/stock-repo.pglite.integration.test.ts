// @vitest-environment node
/**
 * Lectures admin de `stockRepo` sur un vrai moteur SQL (pglite), et effet d'une
 * remise en stock admin sur la réservation qui bloquait les commandes.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';

import { __resetTestDb, __setTestDb } from '@/lib/db/client';

import { stockRepo } from './stock-repo';

let client: PGlite;
const STOCK_MIGRATIONS = ['0019_product_stock.sql', '0088_stock_negatif_historique.sql'].map(
  (file) => resolve(process.cwd(), 'drizzle/migrations', file),
);

beforeAll(async () => {
  client = new PGlite();
  __setTestDb(drizzlePglite(client) as unknown as Parameters<typeof __setTestDb>[0]);
  await client.exec(`
    CREATE TABLE products (
      id text PRIMARY KEY, slug text NOT NULL, title text NOT NULL,
      status text NOT NULL, position integer NOT NULL DEFAULT 0
    );
    CREATE TABLE product_variants (
      id text PRIMARY KEY, product_id text NOT NULL REFERENCES products(id),
      sku text NOT NULL, label text NOT NULL, position integer NOT NULL DEFAULT 0
    );
    CREATE TABLE orders (id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE order_items (
      id text PRIMARY KEY, order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      sku text NOT NULL, name text NOT NULL DEFAULT '', quantity integer NOT NULL,
      unit_price_cents integer NOT NULL DEFAULT 0
    );
  `);
  for (const migration of STOCK_MIGRATIONS) {
    const statements = readFileSync(migration, 'utf8')
      .split(/^\s*-->\s*statement-breakpoint\s*$/im)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) await client.exec(statement);
  }
});

afterAll(() => __resetTestDb());

beforeEach(async () => {
  await client.exec(`
    TRUNCATE orders, products CASCADE;
    INSERT INTO products (id, slug, title, status, position) VALUES
      ('prod_kit', 'le-kit', 'Le Kit', 'published', 0),
      ('prod_draft', 'brouillon', 'Brouillon', 'draft', 1);
    INSERT INTO product_variants (id, product_id, sku, label, position) VALUES
      ('pvar_kit_0001', 'prod_kit', 'FEMI-KIT-100', 'Pack', 0),
      ('pvar_nocounter', 'prod_kit', 'FEMI-KIT-200', 'Sans compteur', 1),
      ('pvar_draft_01', 'prod_draft', 'DRAFT-1', 'Brouillon', 0);
    INSERT INTO product_stock (variant_id, sku, available, reserved, threshold_low) VALUES
      ('pvar_kit_0001', 'FEMI-KIT-100', 0, 0, 5),
      ('pvar_draft_01', 'DRAFT-1', 3, 1, 5);
  `);
});

describe('stockRepo — lectures admin', () => {
  it('listByVariantIds ne renvoie que les compteurs existants demandés', async () => {
    const rows = await stockRepo.listByVariantIds(['pvar_kit_0001', 'pvar_nocounter']);
    expect(rows).toEqual([
      {
        variantId: 'pvar_kit_0001',
        sku: 'FEMI-KIT-100',
        available: 0,
        reserved: 0,
        thresholdLow: 5,
        sellWhenOut: true,
      },
    ]);
    await expect(stockRepo.listByVariantIds([])).resolves.toEqual([]);
  });

  it('listPublishedVariants exclut les brouillons et garde les variantes sans compteur', async () => {
    const rows = await stockRepo.listPublishedVariants();
    expect(rows.map((r) => r.sku)).toEqual(['FEMI-KIT-100', 'FEMI-KIT-200']);
    expect(rows[0]).toMatchObject({
      productSlug: 'le-kit',
      productTitle: 'Le Kit',
      stock: { variantId: 'pvar_kit_0001', available: 0, reserved: 0, thresholdLow: 5 },
    });
    expect(rows[1]?.stock).toBeNull();
  });
});

const KIT = 'pvar_kit_0001';
const ACTOR = 'adm_test';

async function row() {
  const res = await client.query<{ available: number; sell_when_out: boolean }>(
    `SELECT available, sell_when_out FROM product_stock WHERE variant_id = '${KIT}'`,
  );
  return res.rows[0];
}

async function movements() {
  const res = await client.query<{ kind: string; delta: number; available_after: number }>(
    `SELECT kind, delta, available_after FROM product_stock_movements WHERE variant_id = '${KIT}'`,
  );
  return res.rows;
}

describe('stockRepo — vente à 0', () => {
  it('par défaut, une commande passe à 0 et le stock devient négatif', async () => {
    await expect(stockRepo.reserve(KIT, 2)).resolves.not.toBeNull();
    const after = await stockRepo.commit(KIT, 2);
    expect(after).toMatchObject({ available: -2, reserved: 0 });
  });

  it('blocage activé : la commande est refusée à 0, comme avant', async () => {
    await stockRepo.applyChange({
      variantId: KIT,
      change: { action: 'set_sell_when_out', value: false },
      actorId: ACTOR,
    });
    await expect(stockRepo.reserve(KIT, 1)).resolves.toBeNull();
    expect((await row())?.available).toBe(0);
  });

  it('une réception couvre le négatif sans le remettre à zéro', async () => {
    await stockRepo.reserve(KIT, 12);
    await stockRepo.commit(KIT, 12);
    const partial = await stockRepo.applyChange({
      variantId: KIT,
      change: { action: 'restock', value: 5 },
      actorId: ACTOR,
    });
    expect(partial).toMatchObject({ outcome: 'applied', snapshot: { available: -7 } });
  });

  it('une variante sans compteur reste refusée tant que sa ligne n’existe pas', async () => {
    await expect(stockRepo.reserve('pvar_nocounter', 1)).resolves.toBeNull();
    await stockRepo.ensureRow('pvar_nocounter', 'FEMI-KIT-200');
    await expect(stockRepo.reserve('pvar_nocounter', 1)).resolves.not.toBeNull();
  });
});

describe('stockRepo — gestes admin', () => {
  it('réception : ajoute au stock et écrit l’historique', async () => {
    await stockRepo.applyChange({
      variantId: KIT,
      change: { action: 'restock', value: 100 },
      actorId: ACTOR,
      note: 'Livraison',
    });
    expect((await row())?.available).toBe(100);
    expect(await movements()).toEqual([{ kind: 'restock', delta: 100, available_after: 100 }]);
  });

  it('double envoi : la même saisie n’est appliquée qu’une fois', async () => {
    const send = () =>
      stockRepo.applyChange({
        variantId: KIT,
        change: { action: 'restock', value: 100 },
        actorId: ACTOR,
        idempotencyKey: 'saisie-0001',
      });
    await expect(send()).resolves.toMatchObject({ outcome: 'applied' });
    await expect(send()).resolves.toMatchObject({ outcome: 'replayed', snapshot: { available: 100 } });
    expect((await row())?.available).toBe(100);
    expect(await movements()).toHaveLength(1);
  });

  it('inventaire : refusé si une commande est passée depuis l’affichage', async () => {
    await stockRepo.applyChange({
      variantId: KIT,
      change: { action: 'restock', value: 50 },
      actorId: ACTOR,
    });
    await stockRepo.reserve(KIT, 1);
    await stockRepo.commit(KIT, 1);
    const stale = await stockRepo.applyChange({
      variantId: KIT,
      change: { action: 'count', value: 40, expectedAvailable: 50 },
      actorId: ACTOR,
    });
    expect(stale).toMatchObject({ outcome: 'conflict', snapshot: { available: 49 } });
    expect((await row())?.available).toBe(49);
    const fresh = await stockRepo.applyChange({
      variantId: KIT,
      change: { action: 'count', value: 40, expectedAvailable: 49 },
      actorId: ACTOR,
    });
    expect(fresh).toMatchObject({ outcome: 'applied', snapshot: { available: 40 } });
    expect((await movements()).at(-1)).toEqual({ kind: 'count', delta: -9, available_after: 40 });
  });

  it('une erreur d’historique annule aussi la modification du stock', async () => {
    await client.exec(`ALTER TABLE product_stock_movements ADD CONSTRAINT casse CHECK (delta < 0)`);
    await expect(
      stockRepo.applyChange({
        variantId: KIT,
        change: { action: 'restock', value: 10 },
        actorId: ACTOR,
      }),
    ).rejects.toThrow();
    await client.exec(`ALTER TABLE product_stock_movements DROP CONSTRAINT casse`);
    expect((await row())?.available).toBe(0);
  });

  it('crée le compteur manquant à la première réception', async () => {
    const result = await stockRepo.applyChange({
      variantId: 'pvar_nocounter',
      change: { action: 'restock', value: 5 },
      actorId: ACTOR,
    });
    expect(result).toMatchObject({ outcome: 'applied', snapshot: { available: 5, sku: 'FEMI-KIT-200' } });
  });

  it('variante inconnue : not_found', async () => {
    await expect(
      stockRepo.applyChange({
        variantId: 'pvar_inconnue',
        change: { action: 'restock', value: 5 },
        actorId: ACTOR,
      }),
    ).resolves.toEqual({ outcome: 'not_found' });
  });
});

describe('stockRepo — rythme de vente', () => {
  it('additionne les unités commandées depuis la date donnée', async () => {
    await client.exec(`
      INSERT INTO orders (id, created_at) VALUES ('o1', now()), ('o2', now() - interval '10 days');
      INSERT INTO order_items (id, order_id, sku, quantity) VALUES
        ('i1', 'o1', 'FEMI-KIT-100', 3), ('i2', 'o2', 'FEMI-KIT-100', 9);
    `);
    const since = new Date(Date.now() - 7 * 86_400_000);
    const sold = await stockRepo.soldSince(['FEMI-KIT-100', 'DRAFT-1'], since);
    expect(sold.get('FEMI-KIT-100')).toBe(3);
    expect(sold.has('DRAFT-1')).toBe(false);
  });
});
