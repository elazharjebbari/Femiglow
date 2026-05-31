/**
 * Tests d'intégration MSW pour l'endpoint public `/feed.xml`.
 *
 * Couvre :
 *  - status 200, content-type `application/xml; charset=utf-8`,
 *  - cache-control public (CDN-friendly),
 *  - le body est un RSS Google Merchant valide (prologue + namespace
 *    g: + item kit complet),
 *  - la fonction GET du route handler est **strictement self-contained** :
 *    elle ne fait AUCUN appel HTTP externe (le builder et le sérialiseur
 *    sont purs). On le garantit via MSW configuré en mode strict
 *    (`onUnhandledRequest: 'error'`) — si une régression introduit un
 *    fetch (ex : enrichissement d'image distante), le test casse.
 *
 * Le scénario est volontairement reproductible : on stubbe le CMS et le
 * builder de produit DB pour figer l'output XML.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { mockKitPageContent } from '@/data/mock/kit';
import { server } from '@/test/msw/server';

// --------------------------------------------------------------------------
// Mocks : on fige les sources de données en amont du builder pour rendre
// le test 100 % déterministe. La logique métier (builder + XML) reste
// importée telle quelle.
// --------------------------------------------------------------------------

vi.mock('@/lib/cms', () => ({
  cms: {
    getKitPageContent: vi.fn(async () => mockKitPageContent),
  },
}));

vi.mock('@/lib/products/public', () => ({
  // `cache.ts` importe aussi les constantes de slug + locale.
  KIT_PRODUCT_SLUG: 'le-kit',
  KIT_LOCALE: 'fr-MA',
  buildKitPublicProduct: vi.fn(async () => mockKitPageContent.product),
}));

// `cache.ts` wrappe le builder dans `unstable_cache`. En vitest, on
// redirige vers la version non cached pour éviter l'invariant
// `incrementalCache missing`.
vi.mock('@/lib/products/feed/cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/products/feed/cache')>();
  return {
    ...actual,
    getCachedKitFeedXml: vi.fn(async () => actual.buildKitFeedXmlUncached()),
  };
});

beforeAll(() => {
  // Mode strict : un appel HTTP non interceptée fait échouer le test.
  // C'est le contrat MSW qu'on souhaite ici — l'endpoint /feed.xml ne
  // DOIT PAS appeler d'API externe.
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Helper : fabrique un `Request` neutre (sans header conditional GET)
 * pour appeler le handler. La signature `GET(request: Request)` a été
 * introduite en même temps que le conditional GET (304).
 */
function makeFeedRequest(): Request {
  return new Request('http://localhost/feed.xml');
}

describe('GET /feed.xml', () => {
  it('retourne un XML 200 avec les bons headers Merchant-friendly', async () => {
    const { GET } = await import('@/app/feed.xml/route');
    const res = await GET(makeFeedRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(res.headers.get('cache-control')).toContain('public');
    expect(res.headers.get('cache-control')).toContain('max-age');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('produit un RSS 2.0 + namespace g: + tous les champs Merchant requis', async () => {
    const { GET } = await import('@/app/feed.xml/route');
    const res = await GET(makeFeedRequest());
    const body = await res.text();
    expect(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(body).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(body).toContain('<g:id>');
    expect(body).toContain('<g:title>');
    expect(body).toContain('<g:description>');
    expect(body).toContain('<g:link>');
    expect(body).toContain('<g:image_link>');
    expect(body).toContain('<g:availability>in stock</g:availability>');
    expect(body).toContain('<g:price>');
    expect(body).toContain('<g:brand>FemiGlow</g:brand>');
    expect(body).toContain('<g:google_product_category>2915</g:google_product_category>');
  });

  it('expose le slug du kit dans <g:id>', async () => {
    const { GET } = await import('@/app/feed.xml/route');
    const res = await GET(makeFeedRequest());
    const body = await res.text();
    expect(body).toMatch(
      new RegExp(`<g:id>${mockKitPageContent.product.slug}</g:id>`),
    );
  });

  it('échappe les caractères spéciaux dans les balises non-CDATA', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.test/femi&glow';
    try {
      const { GET } = await import('@/app/feed.xml/route');
      const res = await GET(makeFeedRequest());
      const body = await res.text();
      // L'esperluette est escapée dans <g:link>.
      expect(body).toContain('femi&amp;glow');
      expect(body).not.toMatch(/<g:link>https:\/\/[^<]*femi&glow/);
    } finally {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    }
  });

  it('ne fait AUCUN appel HTTP externe (MSW strict, fail si requête sortante)', async () => {
    // server.listen est en mode `onUnhandledRequest: 'error'` : si la
    // route déclenche un fetch externe, MSW lève une erreur qui fait
    // échouer ce test. On valide simplement que le GET termine sans
    // erreur — la garantie est implicite (mais réelle).
    const { GET } = await import('@/app/feed.xml/route');
    await expect(GET(makeFeedRequest())).resolves.toMatchObject({ status: 200 });
  });
});
