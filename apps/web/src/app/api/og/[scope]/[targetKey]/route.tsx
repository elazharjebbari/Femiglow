/**
 * GET /api/og/[scope]/[targetKey]?locale=fr-MA
 *
 * Génère une OG image PNG 1200×630 selon la cascade :
 *   override.og_image_media_id → media (passthrough)
 *   override.og_image_template → render template
 *   settings.default_og_image_media_id → media (passthrough)
 *   default → render template `default`
 *
 * cf. docs/seo-cms/backend/03-og-image-generation.md
 */
import { ImageResponse } from 'next/og';
import { NextResponse } from 'next/server';
import { getOverrideByTarget, getSeoSettings } from '@/lib/db/queries/seo';
import type { OgImageTemplate, SeoScope } from '@/lib/seo/types';
import { SEO_SCOPES, OG_TEMPLATES } from '@/lib/seo/types';
import { MarketingTemplate } from '../../_templates/marketing';
import { ArticleTemplate } from '../../_templates/article';
import { ProductTemplate } from '../../_templates/product';
import { DefaultTemplate } from '../../_templates/default';

export const runtime = 'edge';

const TARGET_KEY_RE = /^[a-z0-9][a-z0-9:_-]*$/;

function isScope(v: string): v is SeoScope {
  return (SEO_SCOPES as readonly string[]).includes(v);
}

function pickTemplate(t: OgImageTemplate) {
  switch (t) {
    case 'marketing':
      return MarketingTemplate;
    case 'article':
      return ArticleTemplate;
    case 'product':
      return ProductTemplate;
    case 'default':
      return DefaultTemplate;
  }
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ scope: string; targetKey: string }> },
): Promise<Response> {
  const params = await ctx.params;
  const { scope: rawScope, targetKey } = params;

  if (!isScope(rawScope) || !TARGET_KEY_RE.test(targetKey)) {
    return NextResponse.json(
      { error: { code: 'invalid_input', message: 'Scope ou targetKey invalide.' } },
      { status: 400 },
    );
  }
  const url = new URL(request.url);
  const locale = url.searchParams.get('locale') ?? 'fr-MA';

  try {
    const [override, settings] = await Promise.all([
      getOverrideByTarget(rawScope, targetKey, locale),
      getSeoSettings(),
    ]);
    const published = override && override.publishedAt ? override : null;

    // 1. Passthrough média sur override
    if (published?.ogImageMediaId) {
      const target = `/api/admin/media/${published.ogImageMediaId}/raw`;
      return NextResponse.redirect(new URL(target, url.origin), 307);
    }

    // 2. Render template depuis override
    let templateKey: OgImageTemplate | null = null;
    if (
      published?.ogImageTemplate &&
      (OG_TEMPLATES as readonly string[]).includes(published.ogImageTemplate)
    ) {
      templateKey = published.ogImageTemplate;
    }

    // 3. Passthrough média settings
    if (!templateKey && settings.defaultOgImageMediaId) {
      const target = `/api/admin/media/${settings.defaultOgImageMediaId}/raw`;
      return NextResponse.redirect(new URL(target, url.origin), 307);
    }

    // 4. Fallback default template
    const Tmpl = pickTemplate(templateKey ?? 'default');

    const title = published?.ogTitle ?? published?.title ?? settings.siteName;
    const description =
      published?.ogDescription ??
      published?.description ??
      settings.defaultDescription ??
      '';

    const updatedAtMs = Math.max(
      published ? new Date(published.updatedAt).getTime() : 0,
      new Date(settings.updatedAt).getTime(),
    );
    const etag = `W/"${rawScope}-${targetKey}-${locale}-${updatedAtMs}"`;

    if (request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304 });
    }

    return new ImageResponse(
      (
        <Tmpl
          title={title || settings.siteName}
          description={description}
          siteName={settings.siteName}
        />
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          ETag: etag,
        },
      },
    );
  } catch (err) {
    // Failsafe : log + 200 fallback (cf. doc backend/03)
    console.warn('og.render_failed', {
      scope: rawScope,
      targetKey,
      err: err instanceof Error ? err.message : String(err),
    });
    return new ImageResponse(
      <DefaultTemplate title="FemiGlow" description="" siteName="FemiGlow" />,
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=300',
        },
      },
    );
  }
}
