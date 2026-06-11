/**
 * GET `/[locale]/sitemap.xml` — sitemap PAR LANGUE.
 *
 * Les `<loc>` ne contiennent que les chemins de la langue demandée
 * (`/ar/sitemap.xml` → uniquement des `/ar/…`). Chaque entrée garde les
 * alternates hreflang fr/ar/en + x-default (recommandation Google). Le légal
 * (non traduit) n'apparaît que dans la langue par défaut (FR).
 *
 * Le sitemap « tout » reste `/sitemap.xml` (cf. `app/sitemap.ts`).
 *
 * Pattern dossier `sitemap.xml/route.ts` (cf. `app/feed.xml/route.ts`).
 */
import { NextResponse } from 'next/server';

import { DEFAULT_LOCALE, isLocale } from '@/i18n.config';
import { buildSitemapEntries, serializeSitemap } from '@/lib/seo/sitemap-builder';

export const runtime = 'nodejs';
// Rafraîchi toutes les heures (contenu = build date + articles/légal DB).
export const revalidate = 3600;

export async function GET(
  _request: Request,
  { params }: { params: { locale: string } },
): Promise<Response> {
  if (!isLocale(params.locale)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const entries = await buildSitemapEntries({
    locUrlLocales: [params.locale],
    // Le légal n'existe qu'en FR → uniquement dans le sitemap de la langue par défaut.
    includeLegal: params.locale === DEFAULT_LOCALE,
  });

  return new NextResponse(serializeSitemap(entries), {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=3600',
      'x-content-type-options': 'nosniff',
    },
  });
}
