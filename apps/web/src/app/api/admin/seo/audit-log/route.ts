/**
 * GET /api/admin/seo/audit-log
 *
 * Liste paginée des audit events scope SEO. Utilisé par
 * `/admin/seo/audit-log` et par le linter pour montrer le contexte
 * « dernière modification ».
 *
 * Query :
 *  - `limit` : nombre par page (1..100, défaut 20).
 *  - `cursor` : id de l'événement de fin de page précédente.
 *  - `action` : filtre exact (e.g. `seo.publish`).
 *  - `actorId` : filtre actor.
 *
 * Réponse :
 *  {
 *    events: AuditEvent[],
 *    nextCursor: string | null
 *  }
 */
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { listSeoAuditEvents } from '@/lib/db/queries/seo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const url = new URL(request.url);
    const limitRaw = url.searchParams.get('limit');
    const cursor = url.searchParams.get('cursor');
    const action = url.searchParams.get('action');
    const actorId = url.searchParams.get('actorId');
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 20;

    const page = await listSeoAuditEvents({
      limit: Number.isFinite(limit) ? limit : 20,
      cursor: cursor || null,
      action: action || null,
      actorId: actorId || null,
    });

    return NextResponse.json(page);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
