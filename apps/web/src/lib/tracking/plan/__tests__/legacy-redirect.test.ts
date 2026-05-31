import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';
import { legacyRedirectIfNeeded } from '../legacy-redirect';

function makeRequest(pathname: string, search = ''): NextRequest {
  const buildUrl = (): URL => {
    const u = new URL(`https://example.com${pathname}${search}`);
    (u as URL & { clone(): URL }).clone = () => buildUrl();
    return u;
  };
  return {
    nextUrl: buildUrl(),
  } as unknown as NextRequest;
}

describe('legacyRedirectIfNeeded', () => {
  const ORIGINAL = process.env.TRACKING_LEGACY_REDIRECT;

  beforeEach(() => {
    delete process.env.TRACKING_LEGACY_REDIRECT;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.TRACKING_LEGACY_REDIRECT;
    else process.env.TRACKING_LEGACY_REDIRECT = ORIGINAL;
  });

  it('retourne null quand le flag est off', () => {
    process.env.TRACKING_LEGACY_REDIRECT = 'off';
    expect(legacyRedirectIfNeeded(makeRequest('/admin/tracking/events'))).toBeNull();
  });

  it('retourne null sur les routes non-legacy', () => {
    process.env.TRACKING_LEGACY_REDIRECT = 'on';
    expect(legacyRedirectIfNeeded(makeRequest('/admin/tracking/plans'))).toBeNull();
    expect(legacyRedirectIfNeeded(makeRequest('/admin/leads'))).toBeNull();
  });

  it('redirige /admin/tracking/events vers /admin/tracking/plans en 302', () => {
    process.env.TRACKING_LEGACY_REDIRECT = 'on';
    const res = legacyRedirectIfNeeded(makeRequest('/admin/tracking/events'));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(302);
    expect(res!.headers.get('location')).toContain('/admin/tracking/plans');
    expect(res!.headers.get('x-deprecation')).toContain('replaced-by:/admin/tracking/plans');
    expect(res!.headers.get('x-deprecation')).toContain('reason:tracking-plan-v2-events-merged');
  });

  it('redirige /admin/tracking/providers', () => {
    process.env.TRACKING_LEGACY_REDIRECT = 'on';
    const res = legacyRedirectIfNeeded(makeRequest('/admin/tracking/providers'));
    expect(res).not.toBeNull();
    expect(res!.headers.get('x-deprecation')).toContain('tracking-plan-v2-providers-merged');
  });

  it('redirige /admin/tracking/gtm', () => {
    process.env.TRACKING_LEGACY_REDIRECT = 'on';
    const res = legacyRedirectIfNeeded(makeRequest('/admin/tracking/gtm/export'));
    expect(res).not.toBeNull();
    expect(res!.headers.get('x-deprecation')).toContain('tracking-plan-v2-gtm-export-merged');
  });

  it('drop la query string lors du redirect', () => {
    process.env.TRACKING_LEGACY_REDIRECT = 'on';
    const res = legacyRedirectIfNeeded(makeRequest('/admin/tracking/events', '?foo=bar'));
    expect(res!.headers.get('location')).not.toContain('foo=bar');
  });
});
