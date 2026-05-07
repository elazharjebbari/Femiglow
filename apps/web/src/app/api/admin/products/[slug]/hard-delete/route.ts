/**
 * DELETE /api/admin/products/[slug]/hard-delete
 * Supprime définitivement product + variants + snapshots.
 * Sécurité : exige que le produit soit déjà archived.
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { deleteProduct, getProductBySlug } from '@/lib/db/queries/products';
import { revalidateProduct } from '@/lib/products/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> | { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const existing = await getProductBySlug(params.slug);
    if (!existing) throw new HttpError('not_found', 'Produit introuvable.');
    if (existing.product.status !== 'archived') {
      return NextResponse.json(
        {
          error: {
            code: 'must_be_archived',
            message: 'Le produit doit d’abord être archivé avant suppression définitive.',
          },
        },
        { status: 409 },
      );
    }
    const ok = await deleteProduct(params.slug);
    if (!ok) throw new HttpError('not_found', 'Produit introuvable.');
    revalidateProduct(existing.product.slug);
    await logAuditEvent({
      action: 'product.hard_delete',
      actorId: session.adminId,
      resourceType: 'product',
      resourceId: existing.product.id,
      meta: {
        slug: existing.product.slug,
        title: existing.product.title,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
