/**
 * Tests buildCouponContext — CPN-05.
 * Cœur : équivalence affichage↔checkout (même visitorKey → même bucket).
 */
import { describe, expect, it } from 'vitest';
import {
  buildCouponContext,
  detectDevice,
  hashVisitorKey,
  normalizeTrafficSource,
} from './context';
import { pickBucket } from './bucketing';

describe('CPN-05 normalizeTrafficSource', () => {
  it('U001 utm_source prioritaire et minusculé', () => {
    expect(normalizeTrafficSource('Paid_Social', 'https://x.com')).toBe('paid_social');
  });
  it('U002 fallback host du referer sans www', () => {
    expect(normalizeTrafficSource(null, 'https://www.facebook.com/feed')).toBe('facebook.com');
  });
  it('U003 referer malformé → null', () => {
    expect(normalizeTrafficSource(null, 'not-a-url')).toBeNull();
  });
  it('U004 rien → null', () => {
    expect(normalizeTrafficSource(null, null)).toBeNull();
  });
});

describe('CPN-05 detectDevice', () => {
  it('U010 UA mobile → mobile', () => {
    expect(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('mobile');
  });
  it('U011 UA desktop → desktop', () => {
    expect(detectDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)')).toBe('desktop');
  });
  it('U012 UA absent → desktop par défaut', () => {
    expect(detectDevice(null)).toBe('desktop');
  });
});

describe('CPN-05 hashVisitorKey (anonyme, stable)', () => {
  it('U020 stable et préfixé', () => {
    const a = hashVisitorKey('sess-123');
    const b = hashVisitorKey('sess-123');
    expect(a).toBe(b);
    expect(a).toMatch(/^vk_[0-9a-f]{16}$/);
  });
  it('U021 absent → null', () => {
    expect(hashVisitorKey(null)).toBeNull();
    expect(hashVisitorKey('')).toBeNull();
  });
  it('U022 jamais la PII en clair', () => {
    expect(hashVisitorKey('sara@example.com')).not.toContain('sara');
  });
});

describe('CPN-05 équivalence Server Component ↔ API checkout', () => {
  it('U030 même session → même visitorKey → même bucket des deux côtés', () => {
    // Surface affichage (SC) : connaît utm + UA mobile
    const sc = buildCouponContext({
      sessionId: 'sess-abc',
      utmSource: 'paid_social',
      userAgent: 'iPhone',
    });
    // Surface checkout (API) : referer différent, UA absent, mais MÊME session
    const api = buildCouponContext({
      sessionId: 'sess-abc',
      referer: 'https://femiglow-maroc.com/kit',
    });
    expect(sc.visitorKey).toBe(api.visitorKey);
    // Le bucket (qui porte l'invariant prix) est identique des deux côtés.
    expect(pickBucket(sc.visitorKey, 'cpn_1', 50)).toBe(pickBucket(api.visitorKey, 'cpn_1', 50));
  });

  it('U031 session absente → visitorKey null → treatment partout', () => {
    const ctx = buildCouponContext({ userAgent: 'iPhone' });
    expect(ctx.visitorKey).toBeNull();
    expect(pickBucket(ctx.visitorKey, 'cpn_1', 100)).toBe('treatment');
  });
});
