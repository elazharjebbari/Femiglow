import { describe, it, expect, beforeEach } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { enforceMailRateLimit } from '../rate-limit';

function makeReq(headers: Record<string, string>): Request {
  return new Request('http://test/api/contact', { method: 'POST', headers });
}

describe('enforceMailRateLimit', () => {
  beforeEach(() => {
    resetMemoryStore();
  });

  it('allows up to the limit then blocks', async () => {
    const ip = '1.2.3.4';
    const req = makeReq({ 'x-forwarded-for': ip });
    // Contact limit is 10/min.
    for (let i = 0; i < 10; i++) {
      const r = await enforceMailRateLimit('contact', req);
      expect(r).toBeNull();
    }
    const blocked = await enforceMailRateLimit('contact', req);
    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
  });

  it('returns Retry-After header on block', async () => {
    const ip = '5.6.7.8';
    const req = makeReq({ 'x-forwarded-for': ip });
    for (let i = 0; i < 10; i++) await enforceMailRateLimit('contact', req);
    const blocked = await enforceMailRateLimit('contact', req);
    expect(blocked?.headers.get('Retry-After')).toBeDefined();
    const retryAfter = Number(blocked?.headers.get('Retry-After'));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it('isolates buckets per IP', async () => {
    const reqA = makeReq({ 'x-forwarded-for': '1.1.1.1' });
    const reqB = makeReq({ 'x-forwarded-for': '2.2.2.2' });
    for (let i = 0; i < 10; i++) await enforceMailRateLimit('contact', reqA);
    // A is now blocked, B should still pass.
    expect(await enforceMailRateLimit('contact', reqA)).not.toBeNull();
    expect(await enforceMailRateLimit('contact', reqB)).toBeNull();
  });

  it('isolates buckets per scope', async () => {
    const req = makeReq({ 'x-forwarded-for': '3.3.3.3' });
    // Burn contact bucket
    for (let i = 0; i < 10; i++) await enforceMailRateLimit('contact', req);
    expect(await enforceMailRateLimit('contact', req)).not.toBeNull();
    // newsletter bucket is independent (limit 5)
    expect(await enforceMailRateLimit('newsletter', req)).toBeNull();
  });

  it('newsletter is more strict (5/min)', async () => {
    const req = makeReq({ 'x-forwarded-for': '4.4.4.4' });
    for (let i = 0; i < 5; i++) {
      expect(await enforceMailRateLimit('newsletter', req)).toBeNull();
    }
    expect((await enforceMailRateLimit('newsletter', req))?.status).toBe(429);
  });

  it('falls back to x-real-ip if x-forwarded-for absent', async () => {
    const req = makeReq({ 'x-real-ip': '9.9.9.9' });
    expect(await enforceMailRateLimit('contact', req)).toBeNull();
  });

  it('parses comma-separated x-forwarded-for and uses the first IP', async () => {
    const reqA = makeReq({ 'x-forwarded-for': '10.0.0.1, 11.0.0.1' });
    const reqB = makeReq({ 'x-forwarded-for': '10.0.0.1' });
    // Same first IP → same bucket. Burn via A, then B should be blocked.
    for (let i = 0; i < 10; i++) await enforceMailRateLimit('contact', reqA);
    expect(await enforceMailRateLimit('contact', reqB)).not.toBeNull();
  });
});
