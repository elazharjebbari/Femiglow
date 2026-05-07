/**
 * POST /api/admin/products/[slug]/publish
 * Snapshot du draft + passage status='published' + revalidate + audit.
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import { publishProduct } from '@/lib/db/queries/products';
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
    let note: string | undefined;
    try {
      const body = (await request.json().catch(() => null)) as
        | { note?: string }
        | null;
      if (body?.note && typeof body.note === 'string') {
        note = body.note.slice(0, 500);
      }
    } catch {
      // ignore
    }
    const result = await publishProduct(params.slug, session.adminId, note);
    if (!result) throw new HttpError('not_found', 'Produit introuvable.');

    revalidateProduct(result.product.slug);

    await logAuditEvent({
      action: 'product.publish',
      actorId: session.adminId,
      resourceType: 'product',
      resourceId: result.product.id,
      meta: {
        slug: result.product.slug,
        snapshotId: result.snapshot.id,
        note: note ?? null,
      },
    });

    return NextResponse.json({
      product: result.product,
      snapshotId: result.snapshot.id,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
