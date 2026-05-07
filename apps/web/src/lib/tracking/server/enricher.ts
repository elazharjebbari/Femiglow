import { createHash } from 'node:crypto';

export type Device = 'mobile' | 'tablet' | 'desktop';

export function anonymizeIp(ip: string): string {
  if (!ip || ip === '0.0.0.0') return '0.0.0.0';
  if (ip.includes(':')) {
    const parts = ip.split(':');
    return `${parts.slice(0, 4).join(':')}::`;
  }
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  return '0.0.0.0';
}

export function hashUserAgent(ua: string): string {
  if (!ua) return '';
  return createHash('sha256').update(ua).digest('hex').slice(0, 32);
}

export function parseDevice(ua: string): Device {
  const lower = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(lower)) return 'tablet';
  if (/mobi|android|iphone|ipod|opera mini|iemobile/.test(lower)) return 'mobile';
  return 'desktop';
}

export interface Geo {
  country?: string;
  region?: string;
  city?: string;
}

export function readGeoFromHeaders(headers: Headers): Geo {
  return {
    country: headers.get('cf-ipcountry') ?? headers.get('x-vercel-ip-country') ?? undefined,
    region:
      headers.get('cf-region') ??
      headers.get('x-vercel-ip-country-region') ??
      undefined,
    city: headers.get('cf-ipcity') ?? headers.get('x-vercel-ip-city') ?? undefined,
  };
}

export interface RequestEnrichment {
  uaHash: string;
  ipAnonymized: string;
  device: Device;
  geo: Geo;
  locale: string;
}

export function enrichRequest(
  request: Request | { headers: Headers },
  ip: string,
  fallbackLocale = 'fr-MA',
): RequestEnrichment {
  const ua = request.headers.get('user-agent') ?? '';
  const acceptLanguage = request.headers.get('accept-language') ?? '';
  const locale = parseLocale(acceptLanguage) ?? fallbackLocale;
  return {
    uaHash: hashUserAgent(ua),
    ipAnonymized: anonymizeIp(ip),
    device: parseDevice(ua),
    geo: readGeoFromHeaders(request.headers),
    locale,
  };
}

function parseLocale(acceptLanguage: string): string | null {
  if (!acceptLanguage) return null;
  const first = acceptLanguage.split(',')[0]?.trim();
  if (!first) return null;
  const lang = first.split(';')[0]?.trim();
  return lang || null;
}
