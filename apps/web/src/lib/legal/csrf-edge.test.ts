/**
 * Edge cases — CSRF Origin check : ports, IPv6, capitalisation, paths
 * dans Referer, hosts subdomain.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

import { checkSameOrigin } from './csrf';

function req(method: string, headers: Record<string, string>): Request {
  return new Request('http://x', { method, headers });
}

describe('CSRF — Origin avec port', () => {
  it('refuse Origin avec port différent', () => {
    expect(
      checkSameOrigin(req('POST', { origin: 'https://femiglow.ma:8443' })).ok,
    ).toBe(false);
  });

  it('accepte Origin sans port (port 443 implicite)', () => {
    expect(
      checkSameOrigin(req('POST', { origin: 'https://femiglow.ma' })).ok,
    ).toBe(true);
  });
});

describe('CSRF — subdomain attaque', () => {
  it('refuse Origin = sous-domaine non-config', () => {
    expect(
      checkSameOrigin(req('POST', { origin: 'https://evil.femiglow.ma' })).ok,
    ).toBe(false);
  });

  it('refuse Origin = parent domain', () => {
    expect(
      checkSameOrigin(req('POST', { origin: 'https://ma' })).ok,
    ).toBe(false);
  });

  it('refuse Origin = https://femiglow.ma.evil.tld (suffix attaque)', () => {
    expect(
      checkSameOrigin(req('POST', { origin: 'https://femiglow.ma.evil.tld' })).ok,
    ).toBe(false);
  });
});

describe('CSRF — capitalisation', () => {
  it('refuse Origin avec casse différente du host (browser-canonicalise normalement mais on est strict)', () => {
    // Les Origins envoyés par les browsers sont toujours en minuscules,
    // donc une casse différente est suspecte → reject.
    expect(
      checkSameOrigin(req('POST', { origin: 'https://FEMIGLOW.MA' })).ok,
    ).toBe(false);
  });
});

describe('CSRF — Referer with path/query', () => {
  it('accepte Referer avec long path', () => {
    expect(
      checkSameOrigin(
        req('POST', {
          referer: 'https://femiglow.ma/admin/legal/cgv/edit?from=list#section',
        }),
      ).ok,
    ).toBe(true);
  });

  it('refuse Referer avec host étranger même si path matche', () => {
    expect(
      checkSameOrigin(
        req('POST', {
          referer: 'https://evil.tld/admin/legal/cgv/edit',
        }),
      ).ok,
    ).toBe(false);
  });

  it('refuse Referer http si SITE_URL est https (downgrade)', () => {
    expect(
      checkSameOrigin(req('POST', { referer: 'http://femiglow.ma/x' })).ok,
    ).toBe(false);
  });
});

describe('CSRF — méthodes spéciales', () => {
  it('autorise OPTIONS (preflight CORS) sans header', () => {
    expect(checkSameOrigin(req('OPTIONS', {})).ok).toBe(true);
  });

  it('autorise GET sans header', () => {
    expect(checkSameOrigin(req('GET', {})).ok).toBe(true);
  });

  it('autorise HEAD sans header', () => {
    expect(checkSameOrigin(req('HEAD', {})).ok).toBe(true);
  });
});

describe('CSRF — Origin null avec divers Referer', () => {
  it("Origin=null + pas de Referer → reject", () => {
    expect(checkSameOrigin(req('POST', { origin: 'null' })).ok).toBe(false);
  });

  it("Origin=null + Referer match → accept", () => {
    expect(
      checkSameOrigin(
        req('POST', { origin: 'null', referer: 'https://femiglow.ma/x' }),
      ).ok,
    ).toBe(true);
  });
});

describe('CSRF — Referer malformé', () => {
  it('refuse Referer non-URL', () => {
    expect(checkSameOrigin(req('POST', { referer: 'not-a-url' })).ok).toBe(false);
  });

  it('refuse Referer = string vide', () => {
    expect(checkSameOrigin(req('POST', { referer: '' })).ok).toBe(false);
  });
});

describe('CSRF — header capitalisation (case-insensitive HTTP)', () => {
  it('accepte avec Origin minuscules (Request normalise)', () => {
    // Request normalise les noms de headers en minuscules
    const r = new Request('http://x', {
      method: 'POST',
      headers: { ORIGIN: 'https://femiglow.ma' } as Record<string, string>,
    });
    expect(checkSameOrigin(r).ok).toBe(true);
  });
});
