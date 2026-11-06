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
const STOCK_MIGRATION = resolve(process.cwd(), 'drizzle/migrations/0019_product_stock.sql');

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
  `);
  const statements = readFileSync(STOCK_MIGRATION, 'utf8')
    .split(/^\s*-->\s*statement-breakpoint\s*$/im)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) await client.exec(statement);
});

afterAll(() => __resetTestDb());

beforeEach(async () => {
  await client.exec(`
    TRUNCATE products CASCADE;
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

describe('stockRepo — effet de la correction admin sur les commandes', () => {
  it('la réservation refusée à 0 passe après une remise en stock', async () => {
    await expect(stockRepo.reserve('pvar_kit_0001', 1)).resolves.toBeNull();
    await stockRepo.setAvailable('pvar_kit_0001', 50, 'adm_1');
    await expect(stockRepo.reserve('pvar_kit_0001', 1)).resolves.toMatchObject({
      available: 50,
      reserved: 1,
    });
  });

  it('une variante sans compteur reste refusée et la mutation admin ne la crée pas', async () => {
    await expect(stockRepo.reserve('pvar_nocounter', 1)).resolves.toBeNull();
    await expect(stockRepo.setAvailable('pvar_nocounter', 50, 'adm_1')).resolves.toBeNull();
  });
});
