/**
 * GET /api/admin/catalog/products/autocomplete
 *
 * Liste des produits (id + slug + titre) pour autocomplete UI. Inclut les
 * brouillons (utile pour préparer une audience avant publication).
 */
import { NextResponse } from 'next/server';
import { desc, isNull, and, or, eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-admin';
import { db as getDb } from '@/lib/db/client';
import { products } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  await requireAdmin('/api/admin/catalog/products/autocomplete');
  const drizzle = getDb();
  if (!drizzle) return NextResponse.json({ products: [] });

  const rows = await drizzle
    .select({
      id: products.id,
      slug: products.slug,
      title: products.title,
      status: products.status,
    })
    .from(products)
    .where(and(isNull(products.archivedAt), or(eq(products.status, 'published'), eq(products.status, 'draft'))))
    .orderBy(desc(products.publishedAt))
    .limit(200);

  return NextResponse.json({ products: rows });
}
