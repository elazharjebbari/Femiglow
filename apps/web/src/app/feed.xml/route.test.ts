/**
 * Vitest — GET /feed.xml (route handler).
 *
 * Couvre :
 *  - chemin succès 200 → headers (etag, last-modified, cache-control)
 *    + body XML valide,
 *  - conditional GET 304 :
 *      · `If-None-Match` qui matche → 304 sans body,
 *      · `If-Modified-Since` post-build → 304 sans body,
 *  - chemin échec (cms throws) → 503 + retry-after + body XML stub
 *    (RSS 2.0 valide mais sans item) + log structuré `feed.xml.failed`.
 *
 * Le but de la résilience : un crash transitoire de la DB ne doit pas
 * faire tomber le feed Google Merchant en 500 nu, ce qui ferait
 * disparaître les produits du Shopping. 503 + retry-after est l'idiome.
 *
 * Note technique : la route appelle `getCachedKitFeedXml`, qui wrappe
 * `buildKitFeedXmlUncached` dans `unstable_cache`. En vitest (hors
 * runtime Next.js), `unstable_cache` jette `Invariant: incrementalCache
 * missing`. On contourne en redirigeant le mock vers la version non
 * cached, ce qui exécute la VRAIE chaîne (`cms.getKitPageContent` +
 * `buildKitPublicProduct` + builder + serializer) sans le wrapping
 * cache. Pour le sous-test où on veut un produit déterministe (pas de
 * variation entre les seeds), on mock `buildKitPublicProduct` à
 * `mockKit`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockKit } from '@/data/mock';
import { logger } from '@/lib/logging/logger';
import * as cmsModule from '@/lib/cms';
import * as feedCacheModule from '@/lib/products/feed/cache';
import * as publicModule from '@/lib/products/public';

import { GET } from './route';

const FEED_URL = 'http://localhost/feed.xml';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request(FEED_URL, { headers });
}

beforeEach(() => {
  // Bypass `unstable_cache` en redirigeant le getter cached vers son
  // inner function — mais on memoize le tuple par test pour mimer la
  // sémantique cache de prod : tous les `GET` d'un même test voient
  // les MÊMES `body`/`etag`/`lastModified`. Sans ça, les tests de
  // conditional GET (304) échoueraient au franchissement de seconde.
  let cached: Awaited<ReturnType<typeof feedCacheModule.buildKitFeedXmlUncached>> | null =
    null;
  vi.spyOn(feedCacheModule, 'getCachedKitFeedXml').mockImplementation(async () => {
    cached ??= await feedCacheModule.buildKitFeedXmlUncached();
    return cached;
  });
  // Produit déterministe pour les assertions sur les fields télémétrie.
  vi.spyOn(publicModule, 'buildKitPublicProduct').mockResolvedValue(mockKit);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /feed.xml — succès', () => {
  it('retourne 200 + XML valide + headers ETag / Last-Modified', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/xml');
    expect(res.headers.get('cache-control')).toContain('public');

    // ETag : forme strong (entouré de guillemets, sans préfixe W/).
    const etag = res.headers.get('etag');
    expect(etag).toMatch(/^"[a-f0-9]{64}"$/);

    // Last-Modified : date HTTP valide.
    const lastModified = res.headers.get('last-modified');
    expect(lastModified).toBeTruthy();
    expect(Number.isFinite(Date.parse(lastModified!))).toBe(true);

    const body = await res.text();
    expect(body.startsWith('<?xml')).toBe(true);
    expect(body).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(body).toContain('<g:brand>FemiGlow</g:brand>');
  });

  it('log feed.xml.served avec duration_ms + bytes + product_slug + etag', async () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    await GET(makeRequest());
    const served = infoSpy.mock.calls.find(([event]) => event === 'feed.xml.served');
    expect(served, 'attendu un log feed.xml.served').toBeDefined();
    const fields = served![1] as Record<string, unknown>;
    expect(fields.route).toBe('/feed.xml');
    expect(typeof fields.duration_ms).toBe('number');
    expect(typeof fields.bytes).toBe('number');
    expect(fields.product_slug).toBeTruthy();
    expect(fields.availability).toBeTruthy();
    expect(fields.etag).toMatch(/^"[a-f0-9]{64}"$/);
  });
});

describe('GET /feed.xml — conditional GET (304)', () => {
  it('renvoie 304 quand If-None-Match matche l\'ETag courant', async () => {
    // Premier appel pour récupérer l'ETag.
    const first = await GET(makeRequest());
    const etag = first.headers.get('etag')!;
    expect(etag).toBeTruthy();

    // Deuxième appel avec If-None-Match.
    const second = await GET(makeRequest({ 'if-none-match': etag }));
    expect(second.status).toBe(304);
    // Pas de body sur 304.
    expect(await second.text()).toBe('');
    // Headers ETag + cache toujours présents (RFC 7232).
    expect(second.headers.get('etag')).toBe(etag);
    expect(second.headers.get('cache-control')).toContain('public');
  });

  it('renvoie 304 quand If-None-Match envoie un ETag weak (W/)', async () => {
    const first = await GET(makeRequest());
    const etag = first.headers.get('etag')!;
    const weakEtag = `W/${etag}`;
    const second = await GET(makeRequest({ 'if-none-match': weakEtag }));
    expect(second.status).toBe(304);
  });

  it('renvoie 304 sur If-None-Match: *', async () => {
    const res = await GET(makeRequest({ 'if-none-match': '*' }));
    expect(res.status).toBe(304);
  });

  it('renvoie 200 quand If-None-Match ne matche pas', async () => {
    const res = await GET(
      makeRequest({ 'if-none-match': '"un-vieil-etag-different"' }),
    );
    expect(res.status).toBe(200);
  });

  it('renvoie 304 quand If-Modified-Since est post-build', async () => {
    // 1 heure dans le futur — strictement >= last-modified.
    const future = new Date(Date.now() + 60 * 60 * 1000).toUTCString();
    const res = await GET(makeRequest({ 'if-modified-since': future }));
    expect(res.status).toBe(304);
  });

  it('renvoie 200 quand If-Modified-Since est pré-build (date passée)', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toUTCString();
    const res = await GET(makeRequest({ 'if-modified-since': past }));
    expect(res.status).toBe(200);
  });

  it('log feed.xml.not_modified avec le marqueur du header utilisé', async () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const first = await GET(makeRequest());
    const etag = first.headers.get('etag')!;
    await GET(makeRequest({ 'if-none-match': etag }));
    const notMod = infoSpy.mock.calls.find(
      ([event]) => event === 'feed.xml.not_modified',
    );
    expect(notMod, 'attendu un log feed.xml.not_modified').toBeDefined();
    const fields = notMod![1] as Record<string, unknown>;
    expect(fields.if_none_match_matched).toBe(true);
    expect(fields.if_modified_since_matched).toBe(false);
  });
});

describe('GET /feed.xml — résilience', () => {
  it('retourne 503 + retry-after quand le CMS throw', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    vi.spyOn(cmsModule.cms, 'getKitPageContent').mockRejectedValueOnce(
      new Error('cms boom'),
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
    expect(res.headers.get('retry-after')).toBe('300');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-type')).toContain('application/xml');

    const body = await res.text();
    // Body de fallback : RSS 2.0 valide mais sans item.
    expect(body.startsWith('<?xml')).toBe(true);
    expect(body).toContain('<rss version="2.0"');
    expect(body).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(body).not.toContain('<item>');

    // Log d'erreur émis avec le message original.
    const failed = errorSpy.mock.calls.find(([event]) => event === 'feed.xml.failed');
    expect(failed, 'attendu un log feed.xml.failed').toBeDefined();
    const fields = failed![1] as Record<string, unknown>;
    expect(fields.error).toContain('cms boom');
  });
});
