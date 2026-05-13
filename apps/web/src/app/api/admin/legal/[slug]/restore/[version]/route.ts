import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { requireSameOrigin } from '@/lib/legal/csrf';
import { restoreLegalPageVersion } from '@/lib/legal/publish';
import { getLegalPageBySlug } from '@/lib/legal/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { slug: string; version: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    requireSameOrigin(request);

    const version = Number(params.version);
    if (!Number.isFinite(version) || version < 1) {
      throw new HttpError('invalid_input', 'Version invalide');
    }

    const result = await restoreLegalPageVersion(params.slug, version, session.adminId);
    if (!result.ok) {
      if (result.code === 'not_found') throw new HttpError('not_found', 'Page non trouvée');
      throw new HttpError('not_found', 'Version non trouvée');
    }

    const page = await getLegalPageBySlug(params.slug);
    return NextResponse.json({
      id: page!.id,
      slug: page!.slug,
      title: page!.title,
      body_md: page!.bodyMd,
      status: page!.status,
      version: page!.version,
      restored_from: version,
    });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
