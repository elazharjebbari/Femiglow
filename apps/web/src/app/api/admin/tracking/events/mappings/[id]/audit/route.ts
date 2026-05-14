import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { listAuditForVersion } from '@/lib/tracking/mappings/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/tracking/events/mappings/[id]/audit — historique audit pour une version */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 200);
    const entries = await listAuditForVersion(decodeURIComponent(params.id), { limit });
    return NextResponse.json(
      { entries, count: entries.length },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
