import { describe, expect, it } from 'vitest';

import {
  extractRequestSignals,
  hasAnySignal,
  type CookieReader,
} from './request-signals';

function makeCookies(map: Record<string, string>): CookieReader {
  return {
    get(name) {
      return map[name] ? { value: map[name] } : undefined;
    },
  };
}

describe('extractRequestSignals — click IDs', () => {
  it('lit les 8 click IDs depuis cookies _fg_*', () => {
    const cookies = makeCookies({
      _fg_gclid: 'g1',
      _fg_gbraid: 'gb1',
      _fg_wbraid: 'wb1',
      _fg_fbclid: 'fb1',
      _fg_ttclid: 'tt1',
      _fg_msclkid: 'ms1',
      _fg_sccid: 'sc1',
      _fg_epik: 'ep1',
    });
    const s = extractRequestSignals({ cookies });
    expect(s.clickIds).toEqual({
      gclid: 'g1',
      gbraid: 'gb1',
      wbraid: 'wb1',
      fbclid: 'fb1',
      ttclid: 'tt1',
      msclkid: 'ms1',
      sccid: 'sc1',
      epik: 'ep1',
    });
  });

  it('absence de cookie click ID → objet vide', () => {
    const s = extractRequestSignals({ cookies: makeCookies({}) });
    expect(s.clickIds).toEqual({});
  });
});

describe('extractRequestSignals — UTM via _fg_landing_qs', () => {
  it('parse _fg_landing_qs JSON correctement', () => {
    const payload = JSON.stringify({
      utm: { utm_source: 'meta', utm_medium: 'cpc', utm_campaign: 'spring' },
      path: '/kit',
      ts: 1234567890,
    });
    const s = extractRequestSignals({
      cookies: makeCookies({ _fg_landing_qs: payload }),
    });
    expect(s.utm).toEqual({
      source: 'meta',
      medium: 'cpc',
      campaign: 'spring',
    });
    expect(s.landingPath).toBe('/kit');
    expect(s.landingTs).toBe(1234567890);
  });

  it('toutes les clés UTM (5) sont extraites', () => {
    const payload = JSON.stringify({
      utm: {
        utm_source: 's',
        utm_medium: 'm',
        utm_campaign: 'c',
        utm_content: 'ct',
        utm_term: 't',
      },
    });
    const s = extractRequestSignals({
      cookies: makeCookies({ _fg_landing_qs: payload }),
    });
    expect(s.utm).toEqual({
      source: 's',
      medium: 'm',
      campaign: 'c',
      content: 'ct',
      term: 't',
    });
  });

  it('JSON invalide → utm vide, pas de crash', () => {
    const s = extractRequestSignals({
      cookies: makeCookies({ _fg_landing_qs: 'not-json' }),
    });
    expect(s.utm).toEqual({});
    expect(s.landingPath).toBe(null);
  });

  it('payload partiel (utm absent) → utm vide', () => {
    const s = extractRequestSignals({
      cookies: makeCookies({
        _fg_landing_qs: JSON.stringify({ path: '/kit', ts: 1 }),
      }),
    });
    expect(s.utm).toEqual({});
    expect(s.landingPath).toBe('/kit');
  });
});

describe('extractRequestSignals — Meta fbp/fbc', () => {
  it('lit _fbp et _fbc', () => {
    const s = extractRequestSignals({
      cookies: makeCookies({
        _fbp: 'fb.1.123.456',
        _fbc: 'fb.1.789.ABC',
      }),
    });
    expect(s.fbp).toBe('fb.1.123.456');
    expect(s.fbc).toBe('fb.1.789.ABC');
  });

  it('absence → null', () => {
    const s = extractRequestSignals({ cookies: makeCookies({}) });
    expect(s.fbp).toBe(null);
    expect(s.fbc).toBe(null);
  });
});

describe('extractRequestSignals — referrer', () => {
  it('passe le referrer fourni', () => {
    const s = extractRequestSignals({
      cookies: makeCookies({}),
      referrer: 'https://google.com/',
    });
    expect(s.referrer).toBe('https://google.com/');
  });

  it('absence → null', () => {
    const s = extractRequestSignals({ cookies: makeCookies({}) });
    expect(s.referrer).toBe(null);
  });
});

describe('extractRequestSignals — defensive', () => {
  it('input sans cookies → empty signals', () => {
    const s = extractRequestSignals({ cookies: undefined as unknown as CookieReader });
    expect(s.utm).toEqual({});
    expect(s.clickIds).toEqual({});
    expect(s.fbp).toBe(null);
  });
});

describe('hasAnySignal', () => {
  it('true si referrer présent', () => {
    expect(
      hasAnySignal({
        ...emptySignals(),
        referrer: 'https://x.com',
      }),
    ).toBe(true);
  });

  it('true si un UTM présent', () => {
    expect(
      hasAnySignal({
        ...emptySignals(),
        utm: { source: 'meta' },
      }),
    ).toBe(true);
  });

  it('true si un click ID présent', () => {
    expect(
      hasAnySignal({
        ...emptySignals(),
        clickIds: { gclid: 'A' },
      }),
    ).toBe(true);
  });

  it('true si fbp ou fbc présent', () => {
    expect(hasAnySignal({ ...emptySignals(), fbp: 'X' })).toBe(true);
    expect(hasAnySignal({ ...emptySignals(), fbc: 'Y' })).toBe(true);
  });

  it('false si tout vide', () => {
    expect(hasAnySignal(emptySignals())).toBe(false);
  });
});

function emptySignals() {
  return {
    utm: {},
    clickIds: {},
    fbp: null,
    fbc: null,
    referrer: null,
    landingPath: null,
    landingTs: null,
  };
}
