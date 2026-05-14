/**
 * Tests redirectToPublic — vérifie que le helper construit l'URL externe
 * depuis les forwarded headers et NON depuis req.url (qui contient l'host
 * interne 127.0.0.1:8011 derrière LiteSpeed).
 */
import { describe, it, expect } from 'vitest';
import { publicBaseUrl, redirectToPublic } from '../redirect-public';

function makeReq(headers: Record<string, string>, url = 'http://127.0.0.1:8011/api/x'): Request {
  return new Request(url, { method: 'POST', headers });
}

describe('publicBaseUrl', () => {
  it('uses X-Forwarded-Host + X-Forwarded-Proto when present', () => {
    const req = makeReq({
      'x-forwarded-host': 'femiglow-maroc.com',
      'x-forwarded-proto': 'https',
    });
    expect(publicBaseUrl(req)).toBe('https://femiglow-maroc.com');
  });

  it('falls back to Host header when X-Forwarded-Host missing', () => {
    const req = makeReq({ host: 'staging.femiglow-maroc.com' });
    expect(publicBaseUrl(req)).toBe('https://staging.femiglow-maroc.com');
  });

  it('defaults proto to https when X-Forwarded-Proto missing', () => {
    const req = makeReq({ 'x-forwarded-host': 'femiglow-maroc.com' });
    expect(publicBaseUrl(req)).toBe('https://femiglow-maroc.com');
  });

  it('respects X-Forwarded-Proto=http (dev edge)', () => {
    const req = makeReq({
      'x-forwarded-host': 'localhost:3000',
      'x-forwarded-proto': 'http',
    });
    expect(publicBaseUrl(req)).toBe('http://localhost:3000');
  });

  it('rejects internal hosts in req.url and falls back to dev/prod default', () => {
    const req = makeReq({}, 'http://127.0.0.1:8011/api/x');
    // INTERNAL_HOST_RE rejects 127.0.0.1 → falls back to default
    expect(publicBaseUrl(req)).not.toContain('127.0.0.1');
    expect(publicBaseUrl(req)).not.toContain('localhost:8011');
  });

  it('rejects localhost in Host header (LiteSpeed forwarding bug)', () => {
    const req = makeReq({ host: 'localhost:8011' });
    expect(publicBaseUrl(req)).not.toContain('localhost:8011');
  });
});

describe('redirectToPublic', () => {
  it('produces a Location with the public host, not 127.0.0.1', () => {
    const req = makeReq({
      'x-forwarded-host': 'femiglow-maroc.com',
      'x-forwarded-proto': 'https',
    });
    const res = redirectToPublic(req, '/admin/chat/faq?ok=seeded');
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe(
      'https://femiglow-maroc.com/admin/chat/faq?ok=seeded',
    );
  });

  it('never leaks the internal 127.0.0.1:8011 host even if req.url uses it', () => {
    const req = makeReq(
      {
        'x-forwarded-host': 'femiglow-maroc.com',
        'x-forwarded-proto': 'https',
      },
      'http://127.0.0.1:8011/api/admin/chat/faq/seed-defaults',
    );
    const res = redirectToPublic(req, '/admin/chat/faq?ok=seeded');
    expect(res.headers.get('location')).not.toContain('127.0.0.1');
    expect(res.headers.get('location')).not.toContain('localhost');
  });
});
