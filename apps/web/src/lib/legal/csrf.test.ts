import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

import { checkSameOrigin, requireSameOrigin } from './csrf';

function req(method: string, headers: Record<string, string> = {}): Request {
  return new Request('http://x', { method, headers });
}

describe('checkSameOrigin', () => {
  it('autorise les méthodes safe (GET/HEAD/OPTIONS) sans header', () => {
    for (const m of ['GET', 'HEAD', 'OPTIONS']) {
      expect(checkSameOrigin(req(m))).toEqual({ ok: true });
    }
  });

  it('refuse POST sans Origin ni Referer', () => {
    const r = checkSameOrigin(req('POST'));
    expect(r).toEqual({ ok: false, reason: 'missing_origin' });
  });

  it('accepte POST avec Origin matchant SITE_URL', () => {
    const r = checkSameOrigin(req('POST', { origin: 'https://femiglow.ma' }));
    expect(r).toEqual({ ok: true });
  });

  it('refuse POST avec Origin étranger', () => {
    const r = checkSameOrigin(req('POST', { origin: 'https://evil.tld' }));
    expect(r).toEqual({ ok: false, reason: 'origin_mismatch' });
  });

  it('accepte POST avec Origin null + Referer matchant', () => {
    const r = checkSameOrigin(
      req('POST', { origin: 'null', referer: 'https://femiglow.ma/admin/legal' }),
    );
    expect(r).toEqual({ ok: true });
  });

  it('refuse POST avec Origin null + Referer étranger', () => {
    const r = checkSameOrigin(
      req('POST', { origin: 'null', referer: 'https://evil.tld/path' }),
    );
    expect(r.ok).toBe(false);
  });

  it('accepte avec uniquement Referer matchant', () => {
    const r = checkSameOrigin(req('PATCH', { referer: 'https://femiglow.ma/x' }));
    expect(r).toEqual({ ok: true });
  });

  it('refuse Referer malformé', () => {
    const r = checkSameOrigin(req('PATCH', { referer: 'not-a-url' }));
    expect(r.ok).toBe(false);
  });
});

describe('requireSameOrigin (throws HttpError)', () => {
  it('throw forbidden si la vérif échoue', () => {
    expect(() => requireSameOrigin(req('POST'))).toThrow(/CSRF check failed/);
  });

  it('no-op si la vérif passe', () => {
    expect(() =>
      requireSameOrigin(req('POST', { origin: 'https://femiglow.ma' })),
    ).not.toThrow();
  });
});
