/**
 * POST /api/admin/products/[slug]/variants/reorder
 * Body: { orderedVariantIds: string[] }
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import {
  getProductBySlug,
  listVariants,
  reorderVariants,
} from '@/lib/db/queries/products';
import { reorderVariantsSchema } from '@/lib/products/schemas';
import { revalidateProduct } from '@/lib/products/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const parsed = reorderVariantsSchema.safeParse(body);
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
    const existing = await listVariants(product.product.id);
    const existingIds = new Set(existing.map((v) => v.id));
    if (
      parsed.data.orderedVariantIds.some((id) => !existingIds.has(id)) ||
      parsed.data.orderedVariantIds.length !== existing.length
    ) {
      return NextResponse.json(
        {
          error: {
            code: 'invalid_input',
            message: 'Liste de variantes invalide.',
          },
        },
        { status: 422 },
      );
    }
    const ordered = await reorderVariants(
      product.product.id,
      parsed.data.orderedVariantIds,
    );
    revalidateProduct(product.product.slug);
    await logAuditEvent({
      action: 'product.variant.reorder',
      actorId: session.adminId,
      resourceType: 'product',
      resourceId: product.product.id,
      meta: { slug: product.product.slug },
    });
    return NextResponse.json({ variants: ordered });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
