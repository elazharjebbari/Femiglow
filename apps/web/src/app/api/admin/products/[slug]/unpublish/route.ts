/**
 * POST /api/admin/products/[slug]/unpublish
 * published → draft. Conserve publishedAt (trace), repasse status='draft'.
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { unpublishProduct } from '@/lib/db/queries/products';
import { revalidateProduct } from '@/lib/products/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ slug: string }> | { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const updated = await unpublishProduct(params.slug);
    if (!updated) throw new HttpError('not_found', 'Produit introuvable.');
    revalidateProduct(updated.slug);
    await logAuditEvent({
      action: 'product.unpublish',
      actorId: session.adminId,
      resourceType: 'product',
      resourceId: updated.id,
      meta: { slug: updated.slug },
    });
    return NextResponse.json({ product: updated });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
