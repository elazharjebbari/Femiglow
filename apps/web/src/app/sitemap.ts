/**
 * Sitemap dynamique de `femiglow.ma`.
 *
 * Sources :
 *  - Routes statiques : URLs canoniques connues, `lastModified` figé à
 *    la date du build (`NEXT_PUBLIC_BUILD_DATE`). Évite de signaler une
 *    « mise à jour » à Googlebot à chaque déploiement sans changement
 *    réel sur la route.
 *  - Articles CMS : `article.updatedAt` (fallback `publishedAt`).
 *  - Pages légales searchable (`include_in_search=true`) :
 *    `page.updatedAt` (fallback `publishedAt`).
 *
 * Robustesse :
 *  - Si la DB est indisponible (build local sans `DATABASE_URL`), les
 *    sections dynamiques retombent sur des listes vides et le sitemap
 *    continue à renvoyer les routes statiques. Pas de 500.
 */
import type { MetadataRoute } from 'next';

import { cms } from '@/lib/cms';
import { env } from '@/lib/env';
import { DEFAULT_LOCALE, LOCALES } from '@/i18n.config';
import { listPublishedSearchablePages } from '@/lib/legal/repository';
import { routes } from '@/lib/routes';

/**
 * URL localisée d'un chemin canonique, calquée sur la convention des pages
 * `[locale]/*` (hreflang `{fr:/fr/…, ar:/ar/…, en:/en/…}`) : préfixe `/[locale]`
 * pour TOUTES les locales (FR inclus). Le chemin racine `/` devient `/[locale]/`.
 */
function localizedPath(locale: string, path: string): string {
  return path === '/' ? `/${locale}/` : `/${locale}${path}`;
}

/**
 * Émet une entrée sitemap PAR locale pour un même chemin (donc chaque URL
 * traduite est un `<loc>` à part entière), chacune portant les alternates
 * hreflang `fr`/`ar`/`en` + `x-default` (→ FR). Conforme aux recommandations
 * Google (chaque variante référence toutes les variantes).
 */
function localizedEntries(
  base: string,
  path: string,
  lastModified: MetadataRoute.Sitemap[number]['lastModified'],
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  priority: number,
): MetadataRoute.Sitemap {
  const languages: Record<string, string> = {};
  for (const loc of LOCALES) languages[loc] = `${base}${localizedPath(loc, path)}`;
  languages['x-default'] = `${base}${localizedPath(DEFAULT_LOCALE, path)}`;
  return LOCALES.map((loc) => ({
    url: `${base}${localizedPath(loc, path)}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: { languages },
  }));
}

/**
 * Date du build, ré-évaluée à chaque `next build` via la section `env` de
 * `next.config.mjs`. Fallback `new Date(0)` si la variable n'est pas
 * disponible (dev local sans rebuild) — comportement neutre.
 */
function getBuildDate(): Date {
  const raw = process.env.NEXT_PUBLIC_BUILD_DATE;
  if (!raw) return new Date(0);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const buildDate = getBuildDate();

  // Pages statiques marketing — chacune déclinée FR/AR/EN (toutes traduites via
  // les routes `[locale]/*`) avec alternates hreflang.
  const staticEntries: MetadataRoute.Sitemap = [
    ...localizedEntries(base, routes.home, buildDate, 'weekly', 1),
    ...localizedEntries(base, routes.rituel, buildDate, 'monthly', 0.9),
    ...localizedEntries(base, routes.kit, buildDate, 'weekly', 0.9),
    ...localizedEntries(base, routes.journal, buildDate, 'weekly', 0.8),
    ...localizedEntries(base, routes.maison, buildDate, 'monthly', 0.7),
    ...localizedEntries(base, routes.contact, buildDate, 'yearly', 0.4),
  ];

  let articleEntries: MetadataRoute.Sitemap = [];
  try {
    const articles = await cms.getArticles({ limit: 100 });
    // Chaque article est rendu en FR/AR/EN (`[locale]/journal/[slug]`) → 1 entrée
    // par locale + alternates. Fraîcheur : `updatedAt` (fallback `publishedAt`).
    articleEntries = articles.flatMap((article) =>
      localizedEntries(
        base,
        routes.article(article.slug),
        article.updatedAt ?? article.publishedAt,
        'monthly',
        0.6,
      ),
    );
  } catch {
    articleEntries = [];
  }

  let legalEntries: MetadataRoute.Sitemap = [];
  try {
    const pages = await listPublishedSearchablePages();
    legalEntries = pages.map((p) => ({
      url: `${base}/legal/${p.slug}`,
      // Pour les pages légales, on privilégie `publishedAt` quand il existe :
      // un ajustement éditorial mineur (orthographe, lien) ne doit pas
      // déclencher de re-crawl si la sémantique est inchangée. `updatedAt`
      // sert de fallback pour les pages jamais publiées formellement.
      // cf. legal-sitemap.test.ts qui verrouille ce contrat.
      lastModified: p.publishedAt ?? p.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.4,
    }));
  } catch {
    // si DB indisponible (build sans DATABASE_URL), on ne casse pas le sitemap
    legalEntries = [];
  }

  return [...staticEntries, ...articleEntries, ...legalEntries];
}
