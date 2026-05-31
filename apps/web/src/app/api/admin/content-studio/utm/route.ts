import { NextResponse } from 'next/server';
import { requireAdminApi, requireContentStudioEnabled } from '@/lib/content-studio/auth';
import { formatErrorResponse } from '@/lib/errors/http-error';
import { getPost } from '@/lib/content-studio/repository';
import { getDraft } from '@/lib/content-studio/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    requireContentStudioEnabled();
    await requireAdminApi();
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    if (!postId) {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'postId requis.' } },
        { status: 400 },
      );
    }
    const post = await getPost(postId);
    if (!post) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Post introuvable.' } },
        { status: 404 },
      );
    }
    const draft = post.draftId ? await getDraft(post.draftId) : null;
    const utm = buildUtmParams(post, draft);
    return NextResponse.json({ utm });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

function buildUtmParams(
  post: { id: string; status: string; utm: Record<string, unknown> },
  draft: { platform: string; format: string; hook: string | null; variantLabel: string } | null,
): Record<string, string> {
  const base = (post.utm ?? {}) as Record<string, string>;
  return {
    utm_source: base.utm_source ?? draft?.platform ?? 'femiglow',
    utm_medium: base.utm_medium ?? draft?.format ?? 'social',
    utm_campaign: base.utm_campaign ?? `cs_${post.id.slice(0, 8)}`,
    utm_content: base.utm_content ?? draft?.hook?.slice(0, 60) ?? draft?.variantLabel ?? '',
    utm_term: base.utm_term ?? '',
  };
}