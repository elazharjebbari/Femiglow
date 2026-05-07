/**
 * GET /api/admin/settings/[section]/snapshots → liste paginée des snapshots.
 * cf. docs/admin-config/architecture/02-data-model.md
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { listAppConfigSnapshots } from '@/lib/db/queries/app-config';
import { SECTIONS, type Section } from '@/lib/admin-config/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  ctx: { params: Promise<{ section: string }> | { section: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const params = await Promise.resolve(ctx.params);
    if (!SECTIONS.includes(params.section as Section)) {
      throw new HttpError('not_found', `Section "${params.section}" inconnue.`);
    }
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') ?? '50')));
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? '0'));
    const includePayload = url.searchParams.get('include') === 'payload';
    const { items, total } = await listAppConfigSnapshots(params.section, { limit, offset });
    return NextResponse.json({
      items: items.map((s) => ({
        id: s.id,
        section: s.section,
        capturedAt: s.capturedAt,
        version: s.version,
        actor: s.actor,
        note: s.note,
        ...(includePayload ? { payload: s.payload } : {}),
      })),
      total,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
