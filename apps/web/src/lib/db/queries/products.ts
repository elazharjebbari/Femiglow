/**
 * Queries Products-CMS — products, variants, snapshots.
 * Dual driver : Drizzle si DATABASE_URL, fallback memoryStore en dev/tests.
 */
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type {
  Product,
  ProductListItem,
  ProductSnapshot,
  ProductStatus,
  ProductVariant,
  ProductWithVariants,
} from '@/lib/products/types';

interface MemoryProductRow extends Product {}
interface MemoryVariantRow extends ProductVariant {}
interface MemorySnapshotRow extends ProductSnapshot {}

interface ExtendedStore {
  products: Map<string, MemoryProductRow>;
  productVariants: Map<string, MemoryVariantRow>;
  productSnapshots: Map<string, MemorySnapshotRow>;
}

function ext(): ExtendedStore {
  const store = memoryStore() as unknown as ExtendedStore & Record<string, unknown>;
  if (!store.products) store.products = new Map();
  if (!store.productVariants) store.productVariants = new Map();
  if (!store.productSnapshots) store.productSnapshots = new Map();
  return store;
}

function rowToProduct(r: typeof schema.products.$inferSelect): Product {
  return {
    id: r.id,
    slug: r.slug,
    status: r.status,
    title: r.title,
    tagline: r.tagline,
    description: r.description,
    category: r.category,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    position: r.position,
    featured: r.featured,
    publishedAt: r.publishedAt,
    archivedAt: r.archivedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    createdBy: r.createdBy,
  };
}

function rowToVariant(r: typeof schema.productVariants.$inferSelect): ProductVariant {
  return {
    id: r.id,
    productId: r.productId,
    sku: r.sku,
    label: r.label,
    priceCents: r.priceCents,
    promoPriceCents: r.promoPriceCents,
    currency: r.currency,
    inventoryStatus: r.inventoryStatus,
    weightG: r.weightG,
    attributes: (r.attributes as Record<string, string>) ?? {},
    position: r.position,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function rowToSnapshot(
  r: typeof schema.productSnapshots.$inferSelect,
): ProductSnapshot {
  return {
    id: r.id,
    productId: r.productId,
    capturedAt: r.capturedAt,
    payload: r.payload,
    actorId: r.actorId,
    note: r.note,
  };
}

export interface ListProductsOptions {
  status?: ProductStatus | 'all';
  category?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: 'updated_at' | 'title' | 'position';
}

export async function listProducts(
  opts: ListProductsOptions = {},
): Promise<{ items: ProductListItem[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(opts.page ?? 1, 1);
  const pageSize = Math.min(Math.max(opts.pageSize ?? 20, 1), 100);
  const offset = (page - 1) * pageSize;
  const drizzle = db();

  if (drizzle) {
    const conds = [];
    if (opts.status && opts.status !== 'all') {
      conds.push(eq(schema.products.status, opts.status));
    }
    if (opts.category) conds.push(eq(schema.products.category, opts.category));
    if (opts.q) {
      conds.push(
        or(
          ilike(schema.products.slug, `%${opts.q}%`),
          ilike(schema.products.title, `%${opts.q}%`),
        )!,
      );
    }
    const where = conds.length ? and(...conds) : undefined;
    const order =
      opts.sort === 'title'
        ? asc(schema.products.title)
        : opts.sort === 'position'
          ? asc(schema.products.position)
          : desc(schema.products.updatedAt);
    const rows = await drizzle
      .select()
      .from(schema.products)
      .where(where as never)
      .orderBy(order)
      .limit(pageSize)
      .offset(offset);
    const productIds = rows.map((r) => r.id);
    const variantsByProduct = new Map<string, ProductVariant[]>();
    if (productIds.length > 0) {
      const vRows = await drizzle
        .select()
        .from(schema.productVariants)
        .where(
          or(...productIds.map((id) => eq(schema.productVariants.productId, id))) as never,
        )
        .orderBy(asc(schema.productVariants.position));
      for (const v of vRows.map(rowToVariant)) {
        const arr = variantsByProduct.get(v.productId) ?? [];
        arr.push(v);
        variantsByProduct.set(v.productId, arr);
      }
    }
    const items: ProductListItem[] = rows.map((r) => {
      const p = rowToProduct(r);
      const variants = variantsByProduct.get(p.id) ?? [];
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        status: p.status,
        category: p.category,
        primaryPriceCents: variants[0]?.priceCents ?? null,
        variantCount: variants.length,
        publishedAt: p.publishedAt,
        updatedAt: p.updatedAt,
      };
    });
    // total: re-query count (simple)
    const totalRows = await drizzle
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(where as never);
    return { items, total: totalRows.length, page, pageSize };
  }

  // Memory store
  const all = Array.from(ext().products.values());
  let filtered = all;
  if (opts.status && opts.status !== 'all') {
    filtered = filtered.filter((p) => p.status === opts.status);
  }
  if (opts.category) filtered = filtered.filter((p) => p.category === opts.category);
  if (opts.q) {
    const q = opts.q.toLowerCase();
    filtered = filtered.filter(
      (p) => p.slug.toLowerCase().includes(q) || p.title.toLowerCase().includes(q),
    );
  }
  if (opts.sort === 'title') filtered.sort((a, b) => a.title.localeCompare(b.title));
  else if (opts.sort === 'position') filtered.sort((a, b) => a.position - b.position);
  else filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const sliced = filtered.slice(offset, offset + pageSize);
  const variants = Array.from(ext().productVariants.values());
  const items: ProductListItem[] = sliced.map((p) => {
    const vList = variants.filter((v) => v.productId === p.id);
    vList.sort((a, b) => a.position - b.position);
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      status: p.status,
      category: p.category,
      primaryPriceCents: vList[0]?.priceCents ?? null,
      variantCount: vList.length,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
    };
  });
  return { items, total: filtered.length, page, pageSize };
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductWithVariants | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.products)
      .where(eq(schema.products.slug, slug))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const product = rowToProduct(row);
    const vRows = await drizzle
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.productId, product.id))
      .orderBy(asc(schema.productVariants.position));
    return { product, variants: vRows.map(rowToVariant) };
  }
  for (const p of ext().products.values()) {
    if (p.slug === slug) {
      const variants = Array.from(ext().productVariants.values()).filter(
        (v) => v.productId === p.id,
      );
      variants.sort((a, b) => a.position - b.position);
      return { product: p, variants };
    }
  }
  return null;
}

export async function getProductById(
  id: string,
): Promise<ProductWithVariants | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return getProductBySlug(row.slug);
  }
  const p = ext().products.get(id);
  if (!p) return null;
  return getProductBySlug(p.slug);
}

export interface CreateProductInput {
  slug: string;
  title: string;
  category?: string;
  actorId: string | null;
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const now = new Date();
  const drizzle = db();
  const id = createId('prod');
  const values = {
    id,
    slug: input.slug,
    status: 'draft' as ProductStatus,
    title: input.title,
    tagline: null,
    description: null,
    category: input.category ?? null,
    tags: [] as string[],
    position: 0,
    featured: false,
    publishedAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: input.actorId,
  } satisfies Product;

  if (drizzle) {
    await drizzle.insert(schema.products).values({
      ...values,
      tags: values.tags as never,
    } as never);
    return values;
  }
  ext().products.set(id, values);
  return values;
}

export interface PatchProductInput {
  title?: string;
  tagline?: string | null;
  description?: string | null;
  category?: string | null;
  tags?: string[];
  position?: number;
  featured?: boolean;
  status?: ProductStatus;
}

export async function patchProduct(
  slug: string,
  patch: PatchProductInput,
): Promise<Product | null> {
  const existing = await getProductBySlug(slug);
  if (!existing) return null;
  const now = new Date();
  const drizzle = db();
  const next: Product = {
    ...existing.product,
    ...patch,
    tags: patch.tags ?? existing.product.tags,
    updatedAt: now,
  };
  if (drizzle) {
    await drizzle
      .update(schema.products)
      .set({
        title: next.title,
        tagline: next.tagline,
        description: next.description,
        category: next.category,
        tags: next.tags as never,
        position: next.position,
        featured: next.featured,
        status: next.status,
        updatedAt: now,
      })
      .where(eq(schema.products.id, next.id));
    return next;
  }
  ext().products.set(next.id, next);
  return next;
}

export async function archiveProduct(slug: string): Promise<Product | null> {
  const existing = await getProductBySlug(slug);
  if (!existing) return null;
  const now = new Date();
  const drizzle = db();
  const next: Product = {
    ...existing.product,
    status: 'archived',
    archivedAt: now,
    updatedAt: now,
  };
  if (drizzle) {
    await drizzle
      .update(schema.products)
      .set({ status: 'archived', archivedAt: now, updatedAt: now })
      .where(eq(schema.products.id, next.id));
    return next;
  }
  ext().products.set(next.id, next);
  return next;
}

/**
 * published → draft. Le `publishedAt` est conservé (trace historique),
 * mais le `status` repasse à `draft` pour cacher le produit du public.
 */
export async function unpublishProduct(slug: string): Promise<Product | null> {
  const existing = await getProductBySlug(slug);
  if (!existing) return null;
  if (existing.product.status !== 'published') return existing.product;
  const now = new Date();
  const drizzle = db();
  const next: Product = {
    ...existing.product,
    status: 'draft',
    updatedAt: now,
  };
  if (drizzle) {
    await drizzle
      .update(schema.products)
      .set({ status: 'draft', updatedAt: now })
      .where(eq(schema.products.id, next.id));
    return next;
  }
  ext().products.set(next.id, next);
  return next;
}

/**
 * archived → draft. Réactive un produit archivé (sans le republier).
 */
export async function restoreProduct(slug: string): Promise<Product | null> {
  const existing = await getProductBySlug(slug);
  if (!existing) return null;
  const now = new Date();
  const drizzle = db();
  const next: Product = {
    ...existing.product,
    status: 'draft',
    archivedAt: null,
    updatedAt: now,
  };
  if (drizzle) {
    await drizzle
      .update(schema.products)
      .set({ status: 'draft', archivedAt: null, updatedAt: now })
      .where(eq(schema.products.id, next.id));
    return next;
  }
  ext().products.set(next.id, next);
  return next;
}

/**
 * Suppression définitive : product + variants + snapshots.
 * Réservé aux produits déjà archivés (sécurité).
 */
export async function deleteProduct(slug: string): Promise<boolean> {
  const existing = await getProductBySlug(slug);
  if (!existing) return false;
  const drizzle = db();
  if (drizzle) {
    await drizzle
      .delete(schema.productVariants)
      .where(eq(schema.productVariants.productId, existing.product.id));
    await drizzle
      .delete(schema.productSnapshots)
      .where(eq(schema.productSnapshots.productId, existing.product.id));
    await drizzle.delete(schema.products).where(eq(schema.products.id, existing.product.id));
    return true;
  }
  for (const v of Array.from(ext().productVariants.values())) {
    if (v.productId === existing.product.id) ext().productVariants.delete(v.id);
  }
  for (const s of Array.from(ext().productSnapshots.values())) {
    if (s.productId === existing.product.id) ext().productSnapshots.delete(s.id);
  }
  ext().products.delete(existing.product.id);
  return true;
}

// ---- Variants ----------------------------------------------------------

export async function listVariants(productId: string): Promise<ProductVariant[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.productId, productId))
      .orderBy(asc(schema.productVariants.position));
    return rows.map(rowToVariant);
  }
  const all = Array.from(ext().productVariants.values()).filter(
    (v) => v.productId === productId,
  );
  all.sort((a, b) => a.position - b.position);
  return all;
}

export async function getVariantById(id: string): Promise<ProductVariant | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, id))
      .limit(1);
    return rows[0] ? rowToVariant(rows[0]) : null;
  }
  return ext().productVariants.get(id) ?? null;
}

export interface UpsertVariantInput {
  id?: string;
  productId: string;
  sku: string;
  label: string;
  priceCents: number;
  promoPriceCents?: number | null;
  currency?: string;
  inventoryStatus?: ProductVariant['inventoryStatus'];
  weightG?: number | null;
  attributes?: Record<string, string>;
  position?: number;
}

export async function upsertVariant(input: UpsertVariantInput): Promise<ProductVariant> {
  const now = new Date();
  const id = input.id ?? createId('pvar');
  const drizzle = db();
  const values: ProductVariant = {
    id,
    productId: input.productId,
    sku: input.sku,
    label: input.label,
    priceCents: input.priceCents,
    promoPriceCents: input.promoPriceCents ?? null,
    currency: input.currency ?? 'EUR',
    inventoryStatus: input.inventoryStatus ?? 'available',
    weightG: input.weightG ?? null,
    attributes: input.attributes ?? {},
    position: input.position ?? 0,
    createdAt: input.id ? (await getVariantById(input.id))?.createdAt ?? now : now,
    updatedAt: now,
  };
  if (drizzle) {
    if (input.id) {
      await drizzle
        .update(schema.productVariants)
        .set({
          sku: values.sku,
          label: values.label,
          priceCents: values.priceCents,
          promoPriceCents: values.promoPriceCents,
          currency: values.currency,
          inventoryStatus: values.inventoryStatus,
          weightG: values.weightG,
          attributes: values.attributes as never,
          position: values.position,
          updatedAt: now,
        })
        .where(eq(schema.productVariants.id, id));
    } else {
      await drizzle.insert(schema.productVariants).values({
        ...values,
        attributes: values.attributes as never,
        createdAt: now,
      } as never);
    }
    const rows = await drizzle
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.id, id))
      .limit(1);
    return rowToVariant(rows[0]!);
  }
  ext().productVariants.set(id, values);
  return values;
}

export async function deleteVariant(id: string): Promise<boolean> {
  const drizzle = db();
  if (drizzle) {
    const res = await drizzle
      .delete(schema.productVariants)
      .where(eq(schema.productVariants.id, id))
      .returning();
    return res.length > 0;
  }
  return ext().productVariants.delete(id);
}

export async function reorderVariants(
  productId: string,
  orderedIds: string[],
): Promise<ProductVariant[]> {
  const drizzle = db();
  const now = new Date();
  if (drizzle) {
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (!id) continue;
      await drizzle
        .update(schema.productVariants)
        .set({ position: i, updatedAt: now })
        .where(eq(schema.productVariants.id, id));
    }
    return listVariants(productId);
  }
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    if (!id) continue;
    const v = ext().productVariants.get(id);
    if (v) ext().productVariants.set(id, { ...v, position: i, updatedAt: now });
  }
  return listVariants(productId);
}

// ---- Snapshots ---------------------------------------------------------

export async function createSnapshot(
  productId: string,
  payload: unknown,
  actorId: string | null,
  note?: string,
): Promise<ProductSnapshot> {
  const now = new Date();
  const drizzle = db();
  const snapshot: ProductSnapshot = {
    id: createId('psnap'),
    productId,
    capturedAt: now,
    payload,
    actorId,
    note: note ?? null,
  };
  if (drizzle) {
    await drizzle.insert(schema.productSnapshots).values({
      id: snapshot.id,
      productId,
      capturedAt: now,
      payload: payload as never,
      actorId,
      note: snapshot.note,
    } as never);
    return snapshot;
  }
  ext().productSnapshots.set(snapshot.id, snapshot);
  return snapshot;
}

export async function listSnapshots(
  productId: string,
  limit = 50,
): Promise<ProductSnapshot[]> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.productSnapshots)
      .where(eq(schema.productSnapshots.productId, productId))
      .orderBy(desc(schema.productSnapshots.capturedAt))
      .limit(limit);
    return rows.map(rowToSnapshot);
  }
  const all = Array.from(ext().productSnapshots.values()).filter(
    (s) => s.productId === productId,
  );
  all.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
  return all.slice(0, limit);
}

export async function getSnapshotById(id: string): Promise<ProductSnapshot | null> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.productSnapshots)
      .where(eq(schema.productSnapshots.id, id))
      .limit(1);
    return rows[0] ? rowToSnapshot(rows[0]) : null;
  }
  return ext().productSnapshots.get(id) ?? null;
}

export async function publishProduct(
  slug: string,
  actorId: string | null,
  note?: string,
): Promise<{ product: Product; snapshot: ProductSnapshot } | null> {
  const existing = await getProductBySlug(slug);
  if (!existing) return null;
  const now = new Date();
  const payload = {
    product: existing.product,
    variants: existing.variants,
  };
  const snapshot = await createSnapshot(existing.product.id, payload, actorId, note);
  const drizzle = db();
  const next: Product = {
    ...existing.product,
    status: 'published',
    publishedAt: now,
    updatedAt: now,
  };
  if (drizzle) {
    await drizzle
      .update(schema.products)
      .set({ status: 'published', publishedAt: now, updatedAt: now })
      .where(eq(schema.products.id, next.id));
  } else {
    ext().products.set(next.id, next);
  }
  return { product: next, snapshot };
}
