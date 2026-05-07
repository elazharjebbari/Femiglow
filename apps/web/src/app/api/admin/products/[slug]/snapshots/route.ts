/**
 * GET /api/admin/products/[slug]/snapshots
 * Liste des snapshots produit (paramètre ?include=payload).
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getProductBySlug, listSnapshots } from '@/lib/db/queries/products';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> | { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const product = await getProductBySlug(params.slug);
    if (!product) throw new HttpError('not_found', 'Produit introuvable.');

    const url = new URL(request.url);
    const includePayload = url.searchParams.get('include') === 'payload';
    const snapshots = await listSnapshots(product.product.id, 50);
    const items = snapshots.map((s) => ({
      id: s.id,
      capturedAt: s.capturedAt,
      actorId: s.actorId,
      note: s.note,
      ...(includePayload ? { payload: s.payload } : {}),
    }));
    return NextResponse.json({ items });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
