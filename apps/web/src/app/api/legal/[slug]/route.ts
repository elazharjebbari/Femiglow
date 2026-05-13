import { NextResponse } from 'next/server';

import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getPublishedLegalPage, listAllTemplateVars } from '@/lib/legal/repository';
import { renderLegalMarkdownWithDbVars } from '@/lib/legal/render';

export const runtime = 'nodejs';
export const dynamic = 'force-static';
export const revalidate = 300;

const CACHE_CONTROL = 'public, s-maxage=300, stale-while-revalidate=900';

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  try {
    const page = await getPublishedLegalPage(params.slug);
    if (!page) throw new HttpError('not_found', 'Page non trouvée');

    const vars = await listAllTemplateVars();
    const rendered = await renderLegalMarkdownWithDbVars(
      page.bodyMd,
      vars.map((v) => ({ key: v.key, value: v.value })),
      { mode: 'public', now: page.publishedAt ?? page.updatedAt },
    );

    return NextResponse.json(
      {
        slug: page.slug,
        title: page.title,
        description: page.description,
        content_html: rendered.html,
        headings: rendered.headings,
        last_updated_at: page.publishedAt ?? page.updatedAt,
        version: page.version,
        include_in_search: page.includeInSearch,
        canonical_url: page.canonicalUrl,
      },
      { headers: { 'Cache-Control': CACHE_CONTROL } },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
