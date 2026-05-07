/**
 * POST /api/admin/products/[slug]/restore
 * Body: { snapshotId: string }
 *
 * Recopie le payload d'un snapshot (product + variants) dans le draft.
 * Variantes : remplace l'ensemble (delete+upsert) en re-validant chaque variante.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import {
  deleteVariant,
  getProductBySlug,
  getSnapshotById,
  listVariants,
  patchProduct,
  upsertVariant,
} from '@/lib/db/queries/products';
import {
  productPatchSchema,
  productVariantUpsertSchema,
} from '@/lib/products/schemas';
import { revalidateProduct } from '@/lib/products/cache';
import type { Product, ProductVariant } from '@/lib/products/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ snapshotId: z.string().min(1) });

interface SnapshotPayload {
  product?: Partial<Product>;
  variants?: Partial<ProductVariant>[];
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ slug: string }> | { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const product = await getProductBySlug(params.slug);
    if (!product) throw new HttpError('not_found', 'Produit introuvable.');

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Body restore invalide.',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }

    const snap = await getSnapshotById(parsed.data.snapshotId);
    if (!snap || snap.productId !== product.product.id) {
      throw new HttpError('not_found', 'Snapshot introuvable.');
    }

    const payload = snap.payload as SnapshotPayload | null;
    if (!payload || typeof payload !== 'object' || !payload.product) {
      throw new HttpError('invalid_input', 'Snapshot payload invalide.');
    }

    // Re-valide product
    const productPatch = productPatchSchema.safeParse({
      title: payload.product.title,
      tagline: payload.product.tagline ?? null,
      description: payload.product.description ?? null,
      category: payload.product.category ?? null,
      tags: payload.product.tags ?? [],
      position: payload.product.position ?? 0,
      featured: payload.product.featured ?? false,
    });
    if (!productPatch.success) {
      return NextResponse.json(
        {
          error: {
            code: 'snapshot_incompatible',
            message: 'Snapshot product incompatible.',
            details: productPatch.error.issues,
          },
        },
        { status: 422 },
      );
    }

    // Re-valide chaque variante
    const variantsPayload = Array.isArray(payload.variants)
      ? payload.variants
      : [];
    const validatedVariants: Array<
      ReturnType<typeof productVariantUpsertSchema.parse> & { id?: string }
    > = [];
    for (const v of variantsPayload) {
      const reparsed = productVariantUpsertSchema.safeParse({
        sku: v.sku,
        label: v.label,
        priceCents: v.priceCents,
        promoPriceCents: v.promoPriceCents ?? null,
        currency: v.currency ?? 'EUR',
        inventoryStatus: v.inventoryStatus ?? 'available',
        weightG: v.weightG ?? null,
        attributes: v.attributes ?? {},
        position: v.position ?? 0,
      });
      if (!reparsed.success) {
        return NextResponse.json(
          {
            error: {
              code: 'snapshot_incompatible',
              message: 'Variante du snapshot invalide.',
              details: reparsed.error.issues,
            },
          },
          { status: 422 },
        );
      }
      validatedVariants.push({ ...reparsed.data, id: v.id });
    }

    // Apply: patch product + replace variants
    const updatedProduct = await patchProduct(product.product.slug, productPatch.data);
    const currentVariants = await listVariants(product.product.id);
    const keepIds = new Set(
      validatedVariants.map((v) => v.id).filter((id): id is string => Boolean(id)),
    );
    for (const cv of currentVariants) {
      if (!keepIds.has(cv.id)) {
        await deleteVariant(cv.id);
      }
    }
    for (const v of validatedVariants) {
      await upsertVariant({
        ...(v.id ? { id: v.id } : {}),
        productId: product.product.id,
        sku: v.sku,
        label: v.label,
        priceCents: v.priceCents,
        promoPriceCents: v.promoPriceCents ?? null,
        currency: v.currency,
        inventoryStatus: v.inventoryStatus,
        weightG: v.weightG ?? null,
        attributes: v.attributes,
        position: v.position,
      });
    }

    revalidateProduct(product.product.slug);
    await logAuditEvent({
      action: 'product.restore',
      actorId: session.adminId,
      resourceType: 'product',
      resourceId: product.product.id,
      meta: { slug: product.product.slug, snapshotId: snap.id },
    });

    return NextResponse.json({ product: updatedProduct });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
