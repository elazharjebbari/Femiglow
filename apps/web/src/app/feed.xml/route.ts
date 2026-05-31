/**
 * GET `/feed.xml` — feed produit Google Merchant public.
 *
 * Sortie : RSS 2.0 + namespace `g:` (cf. `lib/products/feed/merchant-xml.ts`).
 * Source : produit kit publié (DB) → fallback mock si absent.
 *
 * Headers (succès) :
 *  - `content-type: application/xml; charset=utf-8`
 *  - `cache-control: public, max-age=300, s-maxage=900` — Google
 *    Merchant Center fetch toutes les 24 h ; on tolère 5 min frais
 *    pour les visiteurs humains et 15 min pour les CDN.
 *  - `etag: "<sha256-hex>"` — content-based, stable tant que le body
 *    est inchangé (cf. `revalidate = 1800` qui fige le body côté Next).
 *  - `last-modified: <RFC 7231 date>` — date du build, alignée avec
 *    `<lastBuildDate>` dans le XML (param `lastBuildDate` de
 *    `merchantFeedXml`).
 *  - `x-content-type-options: nosniff` — protection MIME.
 *
 * Conditional GET :
 *  - `If-None-Match: "<etag>"` matchant → `304 Not Modified` (vide).
 *  - `If-Modified-Since: <date>` >= last-modified → `304 Not Modified`.
 *    Google Merchant supporte ces deux mécanismes pour économiser de
 *    la bande passante et signaler "rien n'a bougé depuis ta dernière
 *    ingestion". On répond donc proprement.
 *
 * Headers (échec) :
 *  - `503 Service Unavailable` + `retry-after: 300` — Google Merchant
 *    backoff propre, sans déréférencer le produit côté Shopping.
 *  - `cache-control: no-store` — ne pas figer une erreur sur un CDN.
 *
 * Logging :
 *  - `feed.xml.served` (succès, code 200) — `duration_ms`, taille du
 *    body, slug produit, prix et disponibilité.
 *  - `feed.xml.not_modified` (succès, code 304) — `duration_ms`, etag,
 *    pour mesurer le ratio 304/200 (proxy de l'effet du conditional GET).
 *  - `feed.xml.failed` (échec, code 503) — message d'erreur + duration.
 *    Sert de canari : si Google Merchant cesse d'ingérer (silencieusement
 *    côté leur dashboard), on le voit ici.
 *
 * Stratégie résilience :
 *  - On ne laisse JAMAIS remonter une 500 nue : Google interpréterait
 *    ça comme une indisponibilité prolongée et retirerait les produits
 *    du Shopping. Un 503 + retry-after est l'idiome attendu.
 *  - Le body de fallback est un RSS 2.0 vide mais valide, qui signale
 *    « aucun produit pour le moment » sans casser le parser.
 *
 * Le path `app/feed.xml/route.ts` est un dossier nommé `feed.xml`
 * (pattern Next.js officiel pour exposer un fichier-extension
 * sans rewrite).
 */
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logging/logger';
import { getCachedKitFeedXml } from '@/lib/products/feed/cache';

export const runtime = 'nodejs';
// 30 minutes — fenêtre alignée sur `getCachedKitFeedXml` (cf.
// `lib/products/feed/cache.ts`). Note : ce `revalidate` côté route
// handler n'a pas d'effet pratique car la route lit `request.headers`
// (conditional GET), ce qui force Next à la traiter comme dynamique.
// Le vrai cache vit dans `unstable_cache` côté builder.
export const revalidate = 1800;

/**
 * Skeleton RSS 2.0 minimal (channel sans item) pour répondre 503 sans
 * casser les parsers en aval. Google Merchant verra "0 produit" (au
 * lieu de "feed cassé"), ce qui est plus tolérable côté algo.
 */
function buildEmptyFallbackFeed(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '  <channel>',
    '    <title>FemiGlow — feed temporairement indisponible</title>',
    '    <link>https://femiglow-maroc.com/kit</link>',
    '    <description>Feed produit en cours de régénération. Réessayez dans quelques minutes.</description>',
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

/**
 * Compare un header `If-None-Match` (potentiellement multi-valeurs ou
 * `*`) avec notre ETag. Tolère les espaces et le préfixe `W/` (weak)
 * que certains proxies ajoutent — RFC 7232 §3.2 : pour 304, weak et
 * strong sont équivalents.
 */
function matchesIfNoneMatch(header: string | null, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === '*') return true;
  return header
    .split(',')
    .map((value) => value.trim().replace(/^W\//, ''))
    .includes(etag);
}

/**
 * Compare un header `If-Modified-Since` avec notre Last-Modified.
 * Si la date du client est >= notre date de build, le client a une
 * version au moins aussi fraîche → 304.
 */
function matchesIfModifiedSince(
  header: string | null,
  lastModified: Date,
): boolean {
  if (!header) return false;
  const since = Date.parse(header);
  if (Number.isNaN(since)) return false;
  // On tronque les ms côté lastModified (HTTP dates ne portent pas les ms)
  // pour éviter une comparaison `since (sec) >= lastModified (sec+ms)` qui
  // serait toujours fausse de qq ms.
  return since >= Math.floor(lastModified.getTime() / 1000) * 1000;
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  try {
    // `getCachedKitFeedXml` retourne `{ body, etag, lastModifiedISO,
    // productSlug, availability, priceMajor, currency, imageUrl }`.
    // L'unstable_cache garantit que tous les hits dans la fenêtre
    // (30 min ou jusqu'au `revalidateTag('product-feed')`) reçoivent
    // les MÊMES `body`/`etag`/`lastModified` — précondition pour que
    // le conditional GET ci-dessous fonctionne réellement en prod.
    const cached = await getCachedKitFeedXml();
    const lastModified = new Date(cached.lastModifiedISO);
    const { body, etag } = cached;

    // Conditional GET — si le client a déjà la même version, on évite
    // de renvoyer le body (économie de bande passante, surtout côté
    // Google Merchant qui poll quotidiennement).
    const reqHeaders = request.headers;
    const ifNoneMatch = reqHeaders.get('if-none-match');
    const ifModifiedSince = reqHeaders.get('if-modified-since');
    if (
      matchesIfNoneMatch(ifNoneMatch, etag) ||
      matchesIfModifiedSince(ifModifiedSince, lastModified)
    ) {
      const durationMs = Date.now() - startedAt;
      logger.info('feed.xml.not_modified', {
        route: '/feed.xml',
        duration_ms: durationMs,
        etag,
        if_none_match_matched: matchesIfNoneMatch(ifNoneMatch, etag),
        if_modified_since_matched: matchesIfModifiedSince(
          ifModifiedSince,
          lastModified,
        ),
      });
      return new NextResponse(null, {
        status: 304,
        headers: {
          etag,
          'last-modified': lastModified.toUTCString(),
          'cache-control': 'public, max-age=300, s-maxage=900',
        },
      });
    }

    const durationMs = Date.now() - startedAt;
    logger.info('feed.xml.served', {
      route: '/feed.xml',
      duration_ms: durationMs,
      bytes: Buffer.byteLength(body, 'utf8'),
      product_slug: cached.productSlug,
      availability: cached.availability,
      price_major: cached.priceMajor,
      currency: cached.currency,
      image_url: cached.imageUrl,
      etag,
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'public, max-age=300, s-maxage=900',
        etag,
        'last-modified': lastModified.toUTCString(),
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    logger.error('feed.xml.failed', {
      route: '/feed.xml',
      duration_ms: durationMs,
      error: message,
      // Stack trace pour debug (le logger redacte les PII automatiquement,
      // un stack trace n'en contient pas dans notre cas).
      stack: err instanceof Error ? err.stack : undefined,
    });
    // Hook Sentry : `Sentry.captureException(err, { tags: { route: '/feed.xml' } })`
    // dès l'installation `@sentry/nextjs` (cf. error.tsx :: Phase 2).

    return new NextResponse(buildEmptyFallbackFeed(), {
      status: 503,
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'no-store',
        'retry-after': '300',
        'x-content-type-options': 'nosniff',
      },
    });
  }
}
