// @vitest-environment node
/**
 * Doublons de commande et relances après achat, sur le vrai SQL : une commande
 * du même numéro pour le même panier, et le `NOT EXISTS` des scanners d'abandon.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';

import { chatLead } from '@/lib/chat/db/schema';
import { __resetTestDb, __setTestDb } from '@/lib/db/client';
import { orderItems, orders, productVariants, products } from '@/lib/db/schema';
import { noRecentPurchaseForPhone } from '@/lib/webhooks/outbound/recent-purchase';
import { orderRepo } from './order-repo';

const NOW = new Date('2026-11-01T12:15:00Z');
const PHONE = '+212653537181';
const OTHER = '+212600000001';
const since = new Date(NOW.getTime() - 30 * 60 * 1000);
const KIT = [{ sku: 'KIT-A', quantity: 1 }];

let client: PGlite;
let db: ReturnType<typeof drizzlePglite>;

/** Colonnes seules : ces tests ne portent pas sur les contraintes. */
async function createTable(table: PgTable) {
  const { name, columns } = getTableConfig(table);
  const list = columns
    .map((c) => `"${c.name}" ${c.columnType === 'PgEnumColumn' ? 'text' : c.getSQLType()}`)
    .join(', ');
  await client.exec(`CREATE TABLE "${name}" (${list})`);
}

async function lead(id: string, phone: string, purchasedAt: string | null = null) {
  await client.query('INSERT INTO chat_lead (id, phone_e164, purchased_at) VALUES ($1, $2, $3)', [
    id,
    phone,
    purchasedAt,
  ]);
}

async function order(id: string, leadId: string, at: string, sku = 'KIT-A', quantity = 1) {
  await client.query(
    `INSERT INTO orders (id, chat_lead_id, total_cents, currency, created_at) VALUES ($1, $2, 13400, 'MAD', $3)`,
    [id, leadId, at],
  );
  await client.query('INSERT INTO order_items (id, order_id, sku, quantity) VALUES ($1, $2, $3, $4)', [
    `oi_${id}`,
    id,
    sku,
    quantity,
  ]);
}

beforeAll(async () => {
  client = new PGlite();
  db = drizzlePglite(client);
  __setTestDb(db as unknown as Parameters<typeof __setTestDb>[0]);
  for (const table of [chatLead, orders, orderItems, products, productVariants]) {
    await createTable(table);
  }
});

afterAll(() => {
  __resetTestDb();
});

beforeEach(async () => {
  await client.exec('TRUNCATE chat_lead, orders, order_items, products, product_variants');
});

describe('orderRepo.findRecentDuplicate', () => {
  const find = (items = KIT, phoneE164 = PHONE) =>
    orderRepo.findRecentDuplicate({ phoneE164, items, since });

  it('même numéro, même panier, 2 minutes après : la première commande', async () => {
    await lead('l1', PHONE);
    await order('o_first', 'l1', '2026-11-01T12:12:13Z');
    expect((await find())?.id).toBe('o_first');
  });

  it('reconnaît le numéro sur un autre lead', async () => {
    await lead('l1', PHONE);
    await lead('l2', PHONE);
    await order('o_first', 'l1', '2026-11-01T12:12:13Z');
    expect((await find())?.id).toBe('o_first');
  });

  it('après le délai : nouvelle commande', async () => {
    await lead('l1', PHONE);
    await order('o_old', 'l1', '2026-11-01T11:00:00Z');
    expect(await find()).toBeNull();
  });

  it('autre numéro : nouvelle commande', async () => {
    await lead('l1', OTHER);
    await order('o_first', 'l1', '2026-11-01T12:12:13Z');
    expect(await find()).toBeNull();
  });

  it('autre panier ou autre quantité : nouvelle commande', async () => {
    await lead('l1', PHONE);
    await order('o_first', 'l1', '2026-11-01T12:12:13Z');
    expect(await find([{ sku: 'KIT-B', quantity: 1 }])).toBeNull();
    expect(await find([{ sku: 'KIT-A', quantity: 2 }])).toBeNull();
  });

  it('un slug produit est comparé à sa variante', async () => {
    await client.query(`INSERT INTO products (id, slug) VALUES ('p1', 'kit')`);
    await client.query(`INSERT INTO product_variants (id, product_id, sku) VALUES ('v1', 'p1', 'KIT-A')`);
    await lead('l1', PHONE);
    await order('o_first', 'l1', '2026-11-01T12:12:13Z');
    expect((await find([{ sku: 'kit', quantity: 1 }]))?.id).toBe('o_first');
  });
});

describe('noRecentPurchaseForPhone', () => {
  const eligible = async () => {
    const rows = await db
      .select({ id: chatLead.id })
      .from(chatLead)
      .where(noRecentPurchaseForPhone(NOW));
    return rows.map((row) => row.id).sort();
  };

  it('écarte le nouveau lead d’un numéro qui vient d’acheter, pas les autres', async () => {
    await lead('bought', PHONE, '2026-11-01T12:00:00Z');
    await lead('same_phone', PHONE);
    await lead('other_phone', OTHER);
    expect(await eligible()).toEqual(['other_phone']);
  });

  it('un achat vieux de plus de 24 h n’empêche plus la relance', async () => {
    await lead('old', PHONE, '2026-10-30T12:00:00Z');
    await lead('same_phone', PHONE);
    expect(await eligible()).toEqual(['old', 'same_phone']);
  });
});
