/**
 * PATCH  /api/admin/products/[slug]/variants/[variantId] → update variante
 * DELETE /api/admin/products/[slug]/variants/[variantId] → supprime variante
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import {
  deleteVariant,
  getProductBySlug,
  getVariantById,
  listVariants,
  upsertVariant,
} from '@/lib/db/queries/products';
import { productVariantPatchSchema } from '@/lib/products/schemas';
import { revalidateProduct } from '@/lib/products/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  ctx: {
    params: Promise<{ slug: string; variantId: string }> | { slug: string; variantId: string };
  },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const product = await getProductBySlug(params.slug);
    if (!product) throw new HttpError('not_found', 'Produit introuvable.');
    const variant = await getVariantById(params.variantId);
    if (!variant || variant.productId !== product.product.id) {
      throw new HttpError('not_found', 'Variante introuvable.');
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = productVariantPatchSchema.safeParse(body);
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
    const merged = { ...variant, ...parsed.data };
    if (
      merged.promoPriceCents !== null &&
      merged.promoPriceCents !== undefined &&
      merged.promoPriceCents >= merged.priceCents
    ) {
      return NextResponse.json(
        {
          error: { code: 'promo_invalid', message: 'promo doit être < prix.' },
        },
        { status: 422 },
      );
    }
    if (parsed.data.sku && parsed.data.sku !== variant.sku) {
      const sib = await listVariants(product.product.id);
      if (sib.some((v) => v.sku === parsed.data.sku && v.id !== variant.id)) {
        return NextResponse.json(
          { error: { code: 'sku_conflict', message: 'SKU déjà utilisé.' } },
          { status: 409 },
        );
      }
    }
    const updated = await upsertVariant({
      id: variant.id,
      productId: product.product.id,
      sku: merged.sku,
      label: merged.label,
      priceCents: merged.priceCents,
      promoPriceCents: merged.promoPriceCents,
      currency: merged.currency,
      inventoryStatus: merged.inventoryStatus,
      weightG: merged.weightG,
      attributes: merged.attributes,
      position: merged.position,
    });
    revalidateProduct(product.product.slug);
    await logAuditEvent({
      action: 'product.variant.update',
      actorId: session.adminId,
      resourceType: 'product_variant',
      resourceId: updated.id,
      meta: { slug: product.product.slug, sku: updated.sku },
    });
    return NextResponse.json({ variant: updated });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _request: Request,
  ctx: {
    params: Promise<{ slug: string; variantId: string }> | { slug: string; variantId: string };
  },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const product = await getProductBySlug(params.slug);
    if (!product) throw new HttpError('not_found', 'Produit introuvable.');
    const variant = await getVariantById(params.variantId);
    if (!variant || variant.productId !== product.product.id) {
      throw new HttpError('not_found', 'Variante introuvable.');
    }
    const ok = await deleteVariant(variant.id);
    if (!ok) throw new HttpError('not_found', 'Variante introuvable.');
    revalidateProduct(product.product.slug);
    await logAuditEvent({
      action: 'product.variant.delete',
      actorId: session.adminId,
      resourceType: 'product_variant',
      resourceId: variant.id,
      meta: { slug: product.product.slug, sku: variant.sku },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
