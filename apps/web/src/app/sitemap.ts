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
import { listPublishedSearchablePages } from '@/lib/legal/repository';
import { routes } from '@/lib/routes';

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

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}${routes.home}`, lastModified: buildDate, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}${routes.rituel}`, lastModified: buildDate, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}${routes.kit}`, lastModified: buildDate, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}${routes.journal}`, lastModified: buildDate, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}${routes.maison}`, lastModified: buildDate, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}${routes.contact}`, lastModified: buildDate, changeFrequency: 'yearly', priority: 0.4 },
  ];

  let articleEntries: MetadataRoute.Sitemap = [];
  try {
    const articles = await cms.getArticles({ limit: 100 });
    articleEntries = articles.map((article) => ({
      url: `${base}${routes.article(article.slug)}`,
      // Priorité à la fraîcheur réelle : `updatedAt` reflète la dernière
      // modification éditoriale ; `publishedAt` ne sert que pour les
      // articles jamais modifiés depuis publication.
      lastModified: article.updatedAt ?? article.publishedAt,
      changeFrequency: 'monthly',
      priority: 0.6,
    }));
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
