/**
 * GET    /api/admin/products/[slug] → détail (product + variants)
 * PATCH  /api/admin/products/[slug] → update draft (productPatchSchema)
 * DELETE /api/admin/products/[slug] → archive (soft)
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import {
  archiveProduct,
  getProductBySlug,
  patchProduct,
} from '@/lib/db/queries/products';
import { productPatchSchema } from '@/lib/products/schemas';
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
    return NextResponse.json({ product: data.product, variants: data.variants });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ slug: string }> | { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = productPatchSchema.safeParse(body);
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
    const updated = await patchProduct(params.slug, parsed.data);
    if (!updated) throw new HttpError('not_found', 'Produit introuvable.');
    revalidateProduct(updated.slug);
    await logAuditEvent({
      action: 'product.draft_update',
      actorId: session.adminId,
      resourceType: 'product',
      resourceId: updated.id,
      meta: { slug: updated.slug, fields: Object.keys(parsed.data) },
    });
    return NextResponse.json({ product: updated });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> | { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const archived = await archiveProduct(params.slug);
    if (!archived) throw new HttpError('not_found', 'Produit introuvable.');
    revalidateProduct(archived.slug);
    await logAuditEvent({
      action: 'product.archive',
      actorId: session.adminId,
      resourceType: 'product',
      resourceId: archived.id,
      meta: { slug: archived.slug },
    });
    return NextResponse.json({ product: archived });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
