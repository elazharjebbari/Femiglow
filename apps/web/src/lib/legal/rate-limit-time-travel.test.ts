/**
 * Time-travel — vérifie le comportement du rate-limit aux franges exactes
 * de la fenêtre (60s) :
 *  - 59.999s après le 1er burst : limite encore active
 *  - 60.001s après : reset → nouveau burst possible
 *  - Le checkRateLimit accepte `now` injecté pour tests déterministes
 *
 * On utilise un override de `Date.now` plutôt que fake-timers car la
 * primitive checkRateLimit() lit Date.now() directement.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://femiglow.ma' },
}));

import { resetMemoryStore } from '@/lib/db/client';
import { enforceLegalRateLimit } from './rate-limit';

const FIXED_T0 = 1_700_000_000_000;
let nowMock: number = FIXED_T0;
const realDateNow = Date.now;

beforeEach(() => {
  resetMemoryStore();
  nowMock = FIXED_T0;
  Date.now = () => nowMock;
});

afterEach(() => {
  Date.now = realDateNow;
});

function advance(ms: number) {
  nowMock += ms;
}

describe('Rate-limit — frange exacte de la fenêtre 60s', () => {
  it('saturé à T+0, encore bloqué à T+59.999s', async () => {
    const limit = { limit: 1, windowMs: 60_000 };
    const id = 'test-narrow-boundary';

    const r1 = await enforceLegalRateLimit('frange', id, limit);
    expect(r1.ok).toBe(true);

    advance(59_999);
    const r2 = await enforceLegalRateLimit('frange', id, limit);
    expect(r2.ok).toBe(false);
  });

  it('reset à T+60.001s (fenêtre expirée)', async () => {
    const limit = { limit: 1, windowMs: 60_000 };
    const id = 'test-reset';

    await enforceLegalRateLimit('reset', id, limit);
    advance(60_001);
    const r = await enforceLegalRateLimit('reset', id, limit);
    expect(r.ok).toBe(true);
  });

  it('plusieurs cycles successifs : burst, attente, burst', async () => {
    const limit = { limit: 3, windowMs: 60_000 };
    const id = 'test-cycles';

    // Cycle 1
    for (let i = 0; i < 3; i += 1) {
      const r = await enforceLegalRateLimit('cycles', id, limit);
      expect(r.ok).toBe(true);
    }
    const r4 = await enforceLegalRateLimit('cycles', id, limit);
    expect(r4.ok).toBe(false);

    // Cycle 2 : passer la fenêtre
    advance(60_001);
    for (let i = 0; i < 3; i += 1) {
      const r = await enforceLegalRateLimit('cycles', id, limit);
      expect(r.ok).toBe(true);
    }
    const r8 = await enforceLegalRateLimit('cycles', id, limit);
    expect(r8.ok).toBe(false);
  });

  it('X-RateLimit-Reset reflète le futur exact (now + windowMs)', async () => {
    const limit = { limit: 60, windowMs: 60_000 };
    const r = await enforceLegalRateLimit('reset-header', 'id-X', limit);
    if (r.ok) {
      const reset = Number(r.headers['X-RateLimit-Reset']);
      // Reset doit être ~60s dans le futur, peu importe quand on a appelé
      const expected = Math.floor((FIXED_T0 + 60_000) / 1000);
      expect(reset).toBe(expected);
    }
  });

  it('Retry-After exact en secondes restantes', async () => {
    const limit = { limit: 1, windowMs: 60_000 };
    const id = 'retry-after';

    await enforceLegalRateLimit('ra', id, limit);
    advance(30_000); // 30s écoulées
    const r = await enforceLegalRateLimit('ra', id, limit);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const retryAfter = Number(r.response.headers.get('Retry-After'));
      // Reste environ 30s avant reset
      expect(retryAfter).toBeGreaterThan(25);
      expect(retryAfter).toBeLessThanOrEqual(31);
    }
  });
});

describe('Rate-limit — isolation parallèle dans le temps', () => {
  it('clé A satured à T+0, clé B reste OK à T+5s', async () => {
    const limit = { limit: 1, windowMs: 60_000 };
    await enforceLegalRateLimit('iso', 'A', limit);

    advance(5_000);
    const blockedA = await enforceLegalRateLimit('iso', 'A', limit);
    expect(blockedA.ok).toBe(false);

    const okB = await enforceLegalRateLimit('iso', 'B', limit);
    expect(okB.ok).toBe(true);

    // B saturé à T+5s → A reste bloqué, B aussi
    const blockedB = await enforceLegalRateLimit('iso', 'B', limit);
    expect(blockedB.ok).toBe(false);

    advance(56_000); // T = T+61s → A reset, B encore (B saturé à T+5)
    const okAgainA = await enforceLegalRateLimit('iso', 'A', limit);
    expect(okAgainA.ok).toBe(true);

    const stillBlockedB = await enforceLegalRateLimit('iso', 'B', limit);
    expect(stillBlockedB.ok).toBe(false);

    advance(5_000); // T = T+66s → B reset aussi
    const okAgainB = await enforceLegalRateLimit('iso', 'B', limit);
    expect(okAgainB.ok).toBe(true);
  });
});

describe('Rate-limit — micro-boundary', () => {
  it('limite=1, request à T+0, retry à T+59.99s bloqué', async () => {
    const limit = { limit: 1, windowMs: 60_000 };
    await enforceLegalRateLimit('mb', 'micro', limit);
    advance(59_990);
    const r = await enforceLegalRateLimit('mb', 'micro', limit);
    expect(r.ok).toBe(false);
  });

  it('limite=1, retry à T+60.000s exact → comportement déterministe (passe ou bloque, mais consistant)', async () => {
    const limit = { limit: 1, windowMs: 60_000 };
    await enforceLegalRateLimit('mb', 'exact', limit);
    advance(60_000);
    const r = await enforceLegalRateLimit('mb', 'exact', limit);
    // Le check est `current.resetAt <= now` → à T+60_000 exact, resetAt = T+60_000,
    // donc resetAt <= now est vrai → fenêtre considérée expirée → ok.
    expect(r.ok).toBe(true);
  });
});
