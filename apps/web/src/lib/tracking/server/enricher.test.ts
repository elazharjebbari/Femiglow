import { describe, expect, it } from 'vitest';
import {
  anonymizeIp,
  enrichRequest,
  hashUserAgent,
  parseDevice,
  readGeoFromHeaders,
} from './enricher';

describe('enricher', () => {
  it('anonymizeIp : IPv4 → dernier octet à 0', () => {
    expect(anonymizeIp('192.168.42.7')).toBe('192.168.42.0');
    expect(anonymizeIp('203.0.113.99')).toBe('203.0.113.0');
  });

  it('anonymizeIp : IPv6 → tronque les 4 derniers groupes', () => {
    expect(anonymizeIp('2001:db8:abcd:1234:ffff:0:0:1')).toBe('2001:db8:abcd:1234::');
  });

  it('anonymizeIp : valeurs vides → 0.0.0.0', () => {
    expect(anonymizeIp('')).toBe('0.0.0.0');
    expect(anonymizeIp('0.0.0.0')).toBe('0.0.0.0');
  });

  it('hashUserAgent : SHA-256 tronqué à 32 chars', () => {
    const hash = hashUserAgent('Mozilla/5.0');
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it('parseDevice : iPhone → mobile', () => {
    expect(parseDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('mobile');
  });

  it('parseDevice : iPad → tablet', () => {
    expect(parseDevice('Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('tablet');
  });

  it('parseDevice : Mac → desktop', () => {
    expect(parseDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe('desktop');
  });

  it('readGeoFromHeaders : lit Cloudflare et Vercel', () => {
    const headers = new Headers({
      'cf-ipcountry': 'MA',
      'x-vercel-ip-city': 'Casablanca',
    });
    const geo = readGeoFromHeaders(headers);
    expect(geo.country).toBe('MA');
    expect(geo.city).toBe('Casablanca');
  });

  it('enrichRequest : compose un objet complet', () => {
    const req = new Request('http://localhost/', {
      headers: {
        'user-agent': 'Mozilla/5.0 (iPhone)',
        'accept-language': 'fr-MA,fr;q=0.9',
      },
    });
    const enriched = enrichRequest(req, '203.0.113.42');
    expect(enriched.ipAnonymized).toBe('203.0.113.0');
    expect(enriched.device).toBe('mobile');
    expect(enriched.locale).toBe('fr-MA');
    expect(enriched.uaHash).toMatch(/^[0-9a-f]{32}$/);
  });
});
