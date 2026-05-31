import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { resolveVisitorGeo, sanitizeCountry, sanitizeGeoLabel } from './geo';

function request(headers: Record<string, string>): NextRequest {
  return new NextRequest('https://femiglow.test/kit', { headers });
}

describe('promo slide header geo resolver', () => {
  it('reads Cloudflare city and country headers', () => {
    const geo = resolveVisitorGeo(
      request({
        'cf-ipcity': 'Casablanca',
        'cf-region': 'Casablanca-Settat',
        'cf-ipcountry': 'MA',
      }),
    );
    expect(geo).toEqual({
      cityLabel: 'Casablanca',
      regionLabel: 'Casablanca-Settat',
      countryCode: 'MA',
    });
  });

  it('rejects empty, unknown and overlong labels', () => {
    expect(sanitizeGeoLabel(' unknown ')).toBeNull();
    expect(sanitizeGeoLabel('A'.repeat(80))).toBeNull();
    expect(sanitizeGeoLabel('<Rabat>')).toBe('Rabat');
  });

  it('normalizes country codes defensively', () => {
    expect(sanitizeCountry('ma')).toBe('MA');
    expect(sanitizeCountry('T1')).toBeNull();
    expect(sanitizeCountry('MOR')).toBeNull();
  });
});
