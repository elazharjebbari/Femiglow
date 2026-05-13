import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { publishLegalPage } from '@/lib/legal/publish';
import { legalPublishInputSchema } from '@/lib/legal/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = legalPublishInputSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'Tape PUBLIER pour confirmer.' } },
        { status: 400 },
      );
    }

    const result = await publishLegalPage(params.slug, parsed.data.confirm, session.adminId);
    if (result.ok) {
      revalidatePath(`/legal/${params.slug}`);
      revalidatePath('/sitemap.xml');
      return NextResponse.json({
        status: 'published',
        version: result.version,
        publishedAt: result.publishedAt,
      });
    }
    if (result.code === 'not_found') throw new HttpError('not_found', 'Page non trouvée');
    if (result.code === 'confirm_mismatch') {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'Tape PUBLIER pour confirmer.' } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: { code: 'missing_required_vars', message: 'Variables obligatoires manquantes' },
        missing: result.missing,
      },
      { status: 422 },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
