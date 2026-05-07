import { NextResponse } from 'next/server';
import { findMediaById, findMediaBySlug, getMediaWithRelations } from '@/lib/db/queries/media';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { idOrSlug: string } },
): Promise<Response> {
  try {
    const lookup = params.idOrSlug.startsWith('me_')
      ? await findMediaById(params.idOrSlug)
      : await findMediaBySlug(params.idOrSlug);
    if (!lookup || lookup.deletedAt !== null || lookup.status !== 'ready') {
      throw new HttpError('not_found', 'Media indisponible');
    }
    const full = await getMediaWithRelations(lookup.id);
    if (!full) throw new HttpError('not_found', 'Media introuvable');
    return NextResponse.json(full, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
