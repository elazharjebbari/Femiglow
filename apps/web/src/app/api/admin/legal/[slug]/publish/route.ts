import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  LEGAL_PAGE_TAG,
  LEGAL_PUBLISHED_TAG,
} from '@/lib/legal/cache-tags';
import { requireSameOrigin } from '@/lib/legal/csrf';
import { enforceLegalRateLimit, PUBLISH_LIMITS } from '@/lib/legal/rate-limit';
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
    requireSameOrigin(request);

    const rl = await enforceLegalRateLimit('publish', session.adminId, PUBLISH_LIMITS);
    if (!rl.ok) return rl.response;

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
      // Path-based revalidation pour les pages rendues + tag-based pour
      // les fetches via unstable_cache (footer, cookie banner, etc.).
      revalidatePath(`/legal/${params.slug}`);
      revalidatePath('/sitemap.xml');
      revalidateTag(LEGAL_PAGE_TAG(params.slug));
      revalidateTag(LEGAL_PUBLISHED_TAG);
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
    if (result.code === 'same_actor') {
      return NextResponse.json(
        {
          error: {
            code: 'same_actor',
            message:
              'Tu ne peux pas publier une page que tu as toi-même soumise pour revue. Demande à un autre admin de publier.',
          },
        },
        { status: 422 },
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
