/**
 * Tests `extractRequestSignals` — cas defensive & robustesse.
 *
 * Cible : ne jamais throw, retourner systématiquement une structure valide
 * même quand les cookies sont corrompus / inattendus.
 */
import { describe, expect, it } from 'vitest';

import { extractRequestSignals, type CookieReader } from './request-signals';

function makeCookies(map: Record<string, string>): CookieReader {
  return {
    get(name) {
      return map[name] !== undefined ? { value: map[name] } : undefined;
    },
  };
}

describe('extractRequestSignals — cookies corrompus', () => {
  it('JSON _fg_landing_qs avec syntax error → utm vide, pas de throw', () => {
    const r = extractRequestSignals({
      cookies: makeCookies({ _fg_landing_qs: '{utm:meta}' }), // syntax error
    });
    expect(r.utm).toEqual({});
    expect(r.landingPath).toBe(null);
    expect(r.landingTs).toBe(null);
  });

  it('JSON _fg_landing_qs avec types invalides → ignoré silencieusement', () => {
    const r = extractRequestSignals({
      cookies: makeCookies({
        _fg_landing_qs: JSON.stringify({ utm: 'should-be-object' }),
      }),
    });
    expect(r.utm).toEqual({});
  });

  it('JSON _fg_landing_qs vide ("{}") → utm vide', () => {
    const r = extractRequestSignals({
      cookies: makeCookies({ _fg_landing_qs: '{}' }),
    });
    expect(r.utm).toEqual({});
    expect(r.landingPath).toBe(null);
  });

  it('JSON _fg_landing_qs avec keys inattendues → ignore les clés non standard', () => {
    const r = extractRequestSignals({
      cookies: makeCookies({
        _fg_landing_qs: JSON.stringify({
          utm: { utm_source: 'meta', utm_medium: 'cpc', custom_param: 'X' },
          extraField: 'ignored',
          ts: 12345,
        }),
      }),
    });
    expect(r.utm).toEqual({ source: 'meta', medium: 'cpc' });
    expect(r.landingTs).toBe(12345);
  });

  it('JSON avec nested object inattendu → pas de crash', () => {
    const r = extractRequestSignals({
      cookies: makeCookies({
        _fg_landing_qs: JSON.stringify({
          utm: { utm_source: { nested: 'obj' } }, // type invalide
        }),
      }),
    });
    // Le code prend la valeur telle quelle. Pas de validation profonde
    // pour rester performant. L'amont (middleware) garantit le format.
    expect(r.utm.source).toEqual({ nested: 'obj' });
  });

  it('cookie value avec quotes échappées', () => {
    const r = extractRequestSignals({
      cookies: makeCookies({
        _fg_gclid: 'abc"with"quotes',
      }),
    });
    expect(r.clickIds.gclid).toBe('abc"with"quotes');
  });

  it('cookie value très longue (DoS attempt) → accepté tel quel (lib pure)', () => {
    const longValue = 'A'.repeat(10000);
    const r = extractRequestSignals({
      cookies: makeCookies({ _fg_fbclid: longValue }),
    });
    expect(r.clickIds.fbclid).toBe(longValue);
    // La validation de taille est responsabilité de l'amont (middleware ou
    // route handler) — cf. utmSchema dans attribution/types.ts qui valide
    // max 120 chars sur l'écriture DB.
  });
});

describe('extractRequestSignals — chemins de référence ', () => {
  it('referrer null → propagé null', () => {
    const r = extractRequestSignals({
      cookies: makeCookies({}),
      referrer: null,
    });
    expect(r.referrer).toBe(null);
  });

  it('referrer undefined → propagé null', () => {
    const r = extractRequestSignals({ cookies: makeCookies({}) });
    expect(r.referrer).toBe(null);
  });

  it('referrer empty string → propagé tel quel', () => {
    const r = extractRequestSignals({
      cookies: makeCookies({}),
      referrer: '',
    });
    expect(r.referrer).toBe('');
  });

  it('referrer avec espaces → propagé sans normalisation (responsabilité aval)', () => {
    const r = extractRequestSignals({
      cookies: makeCookies({}),
      referrer: '  https://google.com  ',
    });
    expect(r.referrer).toBe('  https://google.com  ');
  });
});

describe('extractRequestSignals — combinaisons complètes', () => {
  it('toutes les sources peuplées → tout extrait correctement', () => {
    const r = extractRequestSignals({
      cookies: makeCookies({
        _fg_gclid: 'G1',
        _fg_fbclid: 'F1',
        _fg_ttclid: 'T1',
        _fg_msclkid: 'M1',
        _fg_sccid: 'S1',
        _fg_epik: 'E1',
        _fg_gbraid: 'GB1',
        _fg_wbraid: 'WB1',
        _fg_landing_qs: JSON.stringify({
          utm: {
            utm_source: 'meta',
            utm_medium: 'cpc',
            utm_campaign: 'spring',
            utm_content: 'banner1',
            utm_term: 'femiglow',
          },
          path: '/kit',
          ts: 1700000000000,
        }),
        _fbp: 'fb.1.123.456',
        _fbc: 'fb.1.789.ABC',
      }),
      referrer: 'https://www.facebook.com/',
    });

    expect(r.clickIds).toEqual({
      gclid: 'G1',
      fbclid: 'F1',
      ttclid: 'T1',
      msclkid: 'M1',
      sccid: 'S1',
      epik: 'E1',
      gbraid: 'GB1',
      wbraid: 'WB1',
    });
    expect(r.utm).toEqual({
      source: 'meta',
      medium: 'cpc',
      campaign: 'spring',
      content: 'banner1',
      term: 'femiglow',
    });
    expect(r.fbp).toBe('fb.1.123.456');
    expect(r.fbc).toBe('fb.1.789.ABC');
    expect(r.referrer).toBe('https://www.facebook.com/');
    expect(r.landingPath).toBe('/kit');
    expect(r.landingTs).toBe(1700000000000);
  });

  it('seulement _fbp (visit revenant) sans landing_qs → fbp lu correctement', () => {
    const r = extractRequestSignals({
      cookies: makeCookies({ _fbp: 'fb.1.100.200' }),
    });
    expect(r.fbp).toBe('fb.1.100.200');
    expect(r.fbc).toBe(null);
    expect(r.utm).toEqual({});
    expect(r.clickIds).toEqual({});
  });
});

describe('extractRequestSignals — pureté & idempotence', () => {
  it('même cookies → même output', () => {
    const cookies = makeCookies({
      _fg_gclid: 'G',
      _fg_landing_qs: JSON.stringify({ utm: { utm_source: 'meta' } }),
    });
    const r1 = extractRequestSignals({ cookies });
    const r2 = extractRequestSignals({ cookies });
    expect(r1).toEqual(r2);
  });

  it('ne lit pas les cookies dont le name n\'est pas dans la map (no scan)', () => {
    // Sanity : la function ne fait QUE des get(name) explicites — utile
    // pour les performances (pas de iterate sur tous les cookies).
    let getCallCount = 0;
    const trackingCookies: CookieReader = {
      get(name) {
        getCallCount += 1;
        return name === '_fg_gclid' ? { value: 'G' } : undefined;
      },
    };
    extractRequestSignals({ cookies: trackingCookies });
    // 8 click IDs + 1 landing_qs + _fbp + _fbc = 11 get calls
    expect(getCallCount).toBe(11);
  });
});
