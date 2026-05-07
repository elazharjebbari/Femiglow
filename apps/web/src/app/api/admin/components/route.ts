/**
 * GET /api/admin/components
 * Liste les composants du registre (avec filtre `pageGroup`).
 */
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { listSiteComponents } from '@/lib/db/queries/site-components';
import { componentListFiltersSchema } from '@/lib/schemas/admin/components';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const url = new URL(request.url);
    const parsed = componentListFiltersSchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) throw new HttpError('invalid_input', 'Filtres invalides');
    const components = await listSiteComponents({ pageGroup: parsed.data.pageGroup });
    return NextResponse.json({ components });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
