// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { middleware } from './middleware';

/**
 * Kit CRO v2 §1 — rewrite interne `/kit` → `/fr/kit`. On vérifie que la
 * réponse réécrite garde tout ce que posait le `next()` : en-têtes de requête
 * propagés (`x-locale`, `x-nonce`), en-têtes de sécurité et capture des
 * click-ids / UTM dès le premier passage.
 */

function makeRequest(path: string, cookies: Record<string, string> = {}): NextRequest {
  const headers = new Headers();
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(new URL(path, 'https://femiglow.test'), { headers });
}

/** Valeur d'un en-tête de requête propagé par `NextResponse.next/rewrite`. */
function forwardedRequestHeader(res: Response, name: string): string | null {
  return res.headers.get(`x-middleware-request-${name}`);
}

beforeEach(() => {
  vi.stubEnv('I18N_ENABLED', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('middleware — /kit et i18n', () => {
  it('rewrite /kit vers /fr/kit sans 307, query préservée', async () => {
    const res = await middleware(makeRequest('/kit?code=GLOW99&utm_content=A-darija'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    const rewrite = res.headers.get('x-middleware-rewrite');
    expect(rewrite).not.toBeNull();
    const target = new URL(rewrite!);
    expect(target.pathname).toBe('/fr/kit');
    expect(target.searchParams.get('code')).toBe('GLOW99');
  });

  it('la réponse réécrite porte x-locale, nonce, CSP et en-têtes de sécurité', async () => {
    const res = await middleware(makeRequest('/kit'));
    expect(forwardedRequestHeader(res, 'x-locale')).toBe('fr');
    expect(forwardedRequestHeader(res, 'x-nonce')).toBeTruthy();
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });

  it('aperçu brouillon des médias par audience : framing same-origin seulement', async () => {
    const res = await middleware(makeRequest('/ar/kit?angle=e&hmv_preview=draft'));
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'self'");
    const plain = await middleware(makeRequest('/ar/kit?angle=e'));
    expect(plain.headers.get('x-frame-options')).toBe('DENY');
    expect(plain.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    const other = await middleware(makeRequest('/ar/rituel?hmv_preview=draft'));
    expect(other.headers.get('x-frame-options')).not.toBe('SAMEORIGIN');
  });

  it('aperçu brouillon : marqueur de requête x-fg-hmv-preview + noindex ; jamais repris du client', async () => {
    const res = await middleware(makeRequest('/ar/kit?angle=e&hmv_preview=draft'));
    expect(forwardedRequestHeader(res, 'x-fg-hmv-preview')).toBe('1');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');

    const spoofed = new NextRequest(new URL('/ar/kit?angle=e', 'https://femiglow.test'), {
      headers: new Headers({ 'x-fg-hmv-preview': '1' }),
    });
    const plain = await middleware(spoofed);
    expect(forwardedRequestHeader(plain, 'x-fg-hmv-preview')).toBeNull();
    expect(plain.headers.get('x-robots-tag')).toBeNull();
  });

  it('capture click-ids et UTM dès le premier passage (plus de second hop)', async () => {
    const res = await middleware(makeRequest('/kit?fbclid=abc123&utm_source=meta'));
    expect(res.cookies.get('_fg_fbclid')?.value).toBe('abc123');
    expect(res.cookies.get('_fbc')?.value).toMatch(/^fb\.1\.\d+\.abc123$/);
    const landing = JSON.parse(res.cookies.get('_fg_landing_qs')!.value) as {
      utm: Record<string, string>;
      path: string;
    };
    expect(landing.utm.utm_source).toBe('meta');
    expect(landing.path).toBe('/kit');
  });

  it('cookie NEXT_LOCALE=ar → 307 vers /ar/kit conservé', async () => {
    const res = await middleware(makeRequest('/kit', { NEXT_LOCALE: 'ar' }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/ar/kit');
  });

  it('KIT_ROOT_REWRITE=off → 307 historique vers /fr/kit', async () => {
    vi.stubEnv('KIT_ROOT_REWRITE', 'off');
    const res = await middleware(makeRequest('/kit?code=GLOW99'));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/fr/kit');
    expect(location.searchParams.get('code')).toBe('GLOW99');
  });

  it('la racine / reste en 307 vers /fr', async () => {
    const res = await middleware(makeRequest('/'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).pathname).toBe('/fr');
  });

  it('i18n désactivée → /kit servi tel quel, x-locale = fr', async () => {
    vi.stubEnv('I18N_ENABLED', 'false');
    const res = await middleware(makeRequest('/kit'));
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(res.headers.get('location')).toBeNull();
    expect(forwardedRequestHeader(res, 'x-locale')).toBe('fr');
  });

  it('route localisée /ar/kit → next() avec x-locale = ar', async () => {
    const res = await middleware(makeRequest('/ar/kit'));
    expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    expect(forwardedRequestHeader(res, 'x-locale')).toBe('ar');
  });
});
