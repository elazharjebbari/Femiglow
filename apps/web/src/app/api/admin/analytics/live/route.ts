/**
 * GET /api/admin/analytics/live
 * Endpoint de polling fallback pour l'onglet Live.
 * cf. docs/analytics/05-onglets-specs.md §2.2
 *
 * Le client (`useAnalyticsSSE`) bascule ici quand SSE échoue (3 disconnects en
 * 30 s) ou n'est pas disponible (proxy intermédiaire qui ne sait pas streamer,
 * Vercel cold start). Refresh recommandé : 5 s.
 *
 * Query param : `window` ∈ ('1h' | '2h' | '3h'), default '1h'.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { LIVE_WINDOWS, readLiveSnapshot } from '@/lib/analytics/queries/live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const QuerySchema = z.object({
  window: z.enum(LIVE_WINDOWS).default('1h'),
});

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const url = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      window: url.searchParams.get('window') ?? undefined,
    });
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Paramètre `window` invalide.');
    }

    const snapshot = await readLiveSnapshot({ window: parsed.data.window });
    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
