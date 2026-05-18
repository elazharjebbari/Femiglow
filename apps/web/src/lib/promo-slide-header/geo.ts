import type { NextRequest } from 'next/server';
import type { VisitorGeo } from './types';

const EMPTY_VALUES = new Set(['', 'xx', 't1', 'unknown', 'null', 'undefined']);

function headerValue(request: NextRequest, key: string): string | null {
  return request.headers.get(key) ?? request.headers.get(key.toLowerCase());
}

export function sanitizeGeoLabel(input: string | null, maxLength = 64): string | null {
  if (!input) return null;
  const cleaned = input
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length === 0 || cleaned.length > maxLength) return null;
  if (EMPTY_VALUES.has(cleaned.toLowerCase())) return null;
  return cleaned;
}

export function sanitizeCountry(input: string | null): string | null {
  const cleaned = sanitizeGeoLabel(input, 3);
  if (!cleaned) return null;
  const upper = cleaned.toUpperCase();
  if (EMPTY_VALUES.has(upper.toLowerCase())) return null;
  return /^[A-Z]{2}$/.test(upper) ? upper : null;
}

export function resolveVisitorGeo(request: NextRequest): VisitorGeo {
  const countryCode = sanitizeCountry(headerValue(request, 'cf-ipcountry'));
  const cityLabel = sanitizeGeoLabel(headerValue(request, 'cf-ipcity'));
  const regionLabel = sanitizeGeoLabel(headerValue(request, 'cf-region'));

  return {
    cityLabel,
    regionLabel,
    countryCode: countryCode ?? 'MA',
  };
}
