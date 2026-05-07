/**
 * GET /api/admin/seo/[id]/snapshots — liste les snapshots audit pour cet override.
 * Permet de paramétrer ?include=payload pour récupérer le payload complet (diff/restore).
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getOverrideById, listAuditSnapshots } from '@/lib/db/queries/seo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    const override = await getOverrideById(params.id);
    if (!override) throw new HttpError('not_found', 'Override introuvable.');

    const url = new URL(request.url);
    const includePayload = url.searchParams.get('include') === 'payload';
    const snapshots = await listAuditSnapshots(
      override.scope,
      override.targetKey,
      override.locale,
      50,
    );
    const items = snapshots.map((s) => ({
      id: s.id,
      capturedAt: s.capturedAt,
      actorId: s.actorId,
      ...(includePayload ? { payload: s.payload } : {}),
    }));
    return NextResponse.json({ items });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
