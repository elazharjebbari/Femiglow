/**
 * GET  /api/admin/products/[slug]/variants → liste
 * POST /api/admin/products/[slug]/variants → créer variante
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import {
  getProductBySlug,
  listVariants,
  upsertVariant,
} from '@/lib/db/queries/products';
import { productVariantUpsertSchema } from '@/lib/products/schemas';
import { revalidateProduct } from '@/lib/products/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> | { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const data = await getProductBySlug(params.slug);
    if (!data) throw new HttpError('not_found', 'Produit introuvable.');
    const variants = await listVariants(data.product.id);
    return NextResponse.json({ variants });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ slug: string }> | { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const data = await getProductBySlug(params.slug);
    if (!data) throw new HttpError('not_found', 'Produit introuvable.');
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = productVariantUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Body invalide.',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }
    // Unicité SKU par produit
    const existing = await listVariants(data.product.id);
    if (existing.some((v) => v.sku === parsed.data.sku)) {
      return NextResponse.json(
        { error: { code: 'sku_conflict', message: 'SKU déjà utilisé pour ce produit.' } },
        { status: 409 },
      );
    }
    const created = await upsertVariant({
      productId: data.product.id,
      ...parsed.data,
    });
    revalidateProduct(data.product.slug);
    await logAuditEvent({
      action: 'product.variant.create',
      actorId: session.adminId,
      resourceType: 'product_variant',
      resourceId: created.id,
      meta: { slug: data.product.slug, sku: created.sku },
    });
    return NextResponse.json({ variant: created }, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
