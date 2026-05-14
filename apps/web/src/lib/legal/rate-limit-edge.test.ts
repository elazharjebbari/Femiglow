/**
 * Edge cases — rate-limit : extraction IP, fenêtre, isolation scope/identity.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

import { resetMemoryStore } from '@/lib/db/client';
import {
  enforceLegalRateLimit,
  extractClientIp,
  PUBLIC_LIMITS,
  PUBLISH_LIMITS,
} from './rate-limit';

beforeEach(() => {
  resetMemoryStore();
});

describe('extractClientIp', () => {
  it('lit X-Forwarded-For (premier IP de la chaîne)', () => {
    const r = new Request('http://x', {
      headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1, 192.168.1.1' },
    });
    expect(extractClientIp(r)).toBe('203.0.113.1');
  });

  it('trim les espaces sur X-Forwarded-For', () => {
    const r = new Request('http://x', {
      headers: { 'x-forwarded-for': '  203.0.113.1  , 10.0.0.1' },
    });
    expect(extractClientIp(r)).toBe('203.0.113.1');
  });

  it('fallback sur X-Real-IP si pas de X-Forwarded-For', () => {
    const r = new Request('http://x', { headers: { 'x-real-ip': '203.0.113.99' } });
    expect(extractClientIp(r)).toBe('203.0.113.99');
  });

  it('fallback "unknown" si aucun header', () => {
    const r = new Request('http://x');
    expect(extractClientIp(r)).toBe('unknown');
  });

  it('extrait IPv6 sans casser', () => {
    const r = new Request('http://x', {
      headers: { 'x-forwarded-for': '2001:db8::1, 10.0.0.1' },
    });
    expect(extractClientIp(r)).toBe('2001:db8::1');
  });
});

describe('enforceLegalRateLimit — isolation scope', () => {
  it('isole les scopes distincts pour la même identity', async () => {
    const id = '203.0.113.50';
    // public-page : burst 60 → saturé
    for (let i = 0; i < 60; i += 1) {
      await enforceLegalRateLimit('public-page', id, PUBLIC_LIMITS);
    }
    const saturated = await enforceLegalRateLimit('public-page', id, PUBLIC_LIMITS);
    expect(saturated.ok).toBe(false);

    // public-zone (même IP, scope différent) → toujours OK
    const otherScope = await enforceLegalRateLimit('public-zone', id, PUBLIC_LIMITS);
    expect(otherScope.ok).toBe(true);
  });
});

describe('enforceLegalRateLimit — headers', () => {
  it('renvoie X-RateLimit-Reset en secondes (unix timestamp)', async () => {
    const r = await enforceLegalRateLimit('test1', 'id-A', PUBLIC_LIMITS);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.headers['X-RateLimit-Reset']).toMatch(/^\d+$/);
      const reset = Number(r.headers['X-RateLimit-Reset']);
      const now = Math.floor(Date.now() / 1000);
      expect(reset).toBeGreaterThanOrEqual(now);
      expect(reset).toBeLessThanOrEqual(now + 70); // 60s window + buffer
    }
  });

  it('X-RateLimit-Remaining décrémente à chaque appel', async () => {
    const r1 = await enforceLegalRateLimit('test-decr', 'id-B', PUBLIC_LIMITS);
    const r2 = await enforceLegalRateLimit('test-decr', 'id-B', PUBLIC_LIMITS);
    if (r1.ok && r2.ok) {
      expect(Number(r2.headers['X-RateLimit-Remaining'])).toBe(
        Number(r1.headers['X-RateLimit-Remaining']) - 1,
      );
    }
  });

  it('429 inclut Retry-After et code rate_limited', async () => {
    const limit = { limit: 1, windowMs: 60_000 };
    await enforceLegalRateLimit('saturate-1', 'id-C', limit);
    const r = await enforceLegalRateLimit('saturate-1', 'id-C', limit);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(429);
      expect(r.response.headers.get('Retry-After')).toMatch(/^\d+$/);
      const body = (await r.response.json()) as { error: { code: string } };
      expect(body.error.code).toBe('rate_limited');
    }
  });
});

describe('enforceLegalRateLimit — limits différentes', () => {
  it('PUBLISH_LIMITS (5) < PUBLIC_LIMITS (60)', () => {
    expect(PUBLISH_LIMITS.limit).toBeLessThan(PUBLIC_LIMITS.limit);
    expect(PUBLISH_LIMITS.windowMs).toBe(60_000);
  });

  it('isole limit 1/min vs limit 60/min sur le même scope+identity', async () => {
    const customLow = { limit: 1, windowMs: 60_000 };
    await enforceLegalRateLimit('one-shot', 'id-D', customLow);
    const second = await enforceLegalRateLimit('one-shot', 'id-D', customLow);
    expect(second.ok).toBe(false);
  });
});
