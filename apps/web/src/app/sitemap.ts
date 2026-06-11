/**
 * Sitemap principal `/sitemap.xml` — TOUTES les langues (FR + AR + EN) + pages
 * légales. Les sitemaps par-langue vivent dans `app/[locale]/sitemap.xml`.
 *
 * Chaque page localisable est déclinée en 3 entrées `<loc>` (une par locale,
 * préfixe `/[locale]` comme les hreflang des pages) portant les alternates
 * hreflang fr/ar/en + x-default. Le légal (non traduit) reste FR racine.
 *
 * Robustesse : si la DB est indisponible (build sans `DATABASE_URL`), les
 * sections dynamiques retombent sur des listes vides — pas de 500.
 *
 * @see lib/seo/sitemap-builder.ts (logique partagée + sérialiseur XML).
 */
import type { MetadataRoute } from 'next';

import { LOCALES } from '@/i18n.config';
import { buildSitemapEntries } from '@/lib/seo/sitemap-builder';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemapEntries({ locUrlLocales: LOCALES, includeLegal: true });
}
