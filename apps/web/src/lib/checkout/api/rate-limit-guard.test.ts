// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import {
  CHECKOUT_RATE_LIMITS,
  checkoutRateLimit,
  isUnroutableIp,
  trustedClientIp,
} from './rate-limit-guard';

const req = (ip?: string) =>
  new Request('https://femiglow-maroc.com/api/checkout/order', {
    method: 'POST',
    headers: ip ? { 'x-forwarded-for': ip } : {},
  });

describe('limite de débit du tunnel', () => {
  beforeEach(() => resetMemoryStore());

  it(`commande : ${CHECKOUT_RATE_LIMITS.order_create} appels passent, le suivant reçoit 429 + Retry-After`, async () => {
    const now = 1_000_000;
    for (let i = 0; i < CHECKOUT_RATE_LIMITS.order_create; i += 1) {
      expect(await checkoutRateLimit(req('41.1.1.1'), 'order_create', now)).toBeNull();
    }
    const res = await checkoutRateLimit(req('41.1.1.1'), 'order_create', now);
    expect(res?.status).toBe(429);
    expect(Number(res?.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(await res?.json()).toMatchObject({ error: { code: 'rate_limited' } });
  });

  it('une autre IP et un autre scope ne sont pas touchés', async () => {
    const now = 1_000_000;
    for (let i = 0; i <= CHECKOUT_RATE_LIMITS.order_create; i += 1) {
      await checkoutRateLimit(req('41.1.1.1'), 'order_create', now);
    }
    expect(await checkoutRateLimit(req('41.2.2.2'), 'order_create', now)).toBeNull();
    expect(await checkoutRateLimit(req('41.1.1.1'), 'lead_create', now)).toBeNull();
  });

  it('la fenêtre de 10 min se rouvre', async () => {
    const now = 1_000_000;
    for (let i = 0; i <= CHECKOUT_RATE_LIMITS.stock_notify; i += 1) {
      await checkoutRateLimit(req('41.1.1.1'), 'stock_notify', now);
    }
    expect(await checkoutRateLimit(req('41.1.1.1'), 'stock_notify', now)).not.toBeNull();
    expect(await checkoutRateLimit(req('41.1.1.1'), 'stock_notify', now + 10 * 60 * 1000 + 1)).toBeNull();
  });

  it('IP : dernière entrée du proxy (la première est forgeable), puis x-real-ip ; cf-connecting-ip ignoré', () => {
    const r = (h: Record<string, string>) => new Request('https://x.test', { headers: h });
    expect(trustedClientIp(r({ 'cf-connecting-ip': '41.0.0.9', 'x-forwarded-for': '41.0.0.1' }))).toBe('41.0.0.1');
    expect(trustedClientIp(r({ 'x-forwarded-for': '6.6.6.6, 41.0.0.7' }))).toBe('41.0.0.7');
    expect(trustedClientIp(r({ 'x-real-ip': '41.0.0.8' }))).toBe('41.0.0.8');
    expect(trustedClientIp(r({}))).toBeNull();
  });

  it('un client qui change la 1re entrée de x-forwarded-for reste limité', async () => {
    const now = 1_000_000;
    let last: Response | null = null;
    for (let i = 0; i <= CHECKOUT_RATE_LIMITS.order_create; i += 1) {
      last = await checkoutRateLimit(
        new Request('https://x.test', { headers: { 'x-forwarded-for': `9.9.9.${i}, 41.3.3.3` } }),
        'order_create',
        now,
      );
    }
    expect(last?.status).toBe(429);
  });

  it('CHECKOUT_RATE_LIMIT_OFF=1 coupe la limite', async () => {
    process.env.CHECKOUT_RATE_LIMIT_OFF = '1';
    try {
      for (let i = 0; i < 100; i += 1) {
        expect(await checkoutRateLimit(req('41.4.4.4'), 'stock_notify', 1)).toBeNull();
      }
    } finally {
      delete process.env.CHECKOUT_RATE_LIMIT_OFF;
    }
  });

  it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1', '10.0.0.5', '172.20.1.1', '192.168.1.10', '0.0.0.0'])(
    'adresse du proxy %s : jamais limitée (sinon compteur unique pour tout le site)',
    async (ip) => {
      expect(isUnroutableIp(ip)).toBe(true);
      for (let i = 0; i < 300; i += 1) {
        expect(await checkoutRateLimit(req(ip), 'order_create', 1)).toBeNull();
      }
    },
  );

  it.each(['41.250.3.4', '105.66.1.2', '172.32.0.1', '2a01:e0a::1'])('IP publique %s : limitée', (ip) => {
    expect(isUnroutableIp(ip)).toBe(false);
  });

  it("sans IP connue (pas d'en-tête proxy) : jamais bloqué, pour ne pas bloquer tout le site", async () => {
    for (let i = 0; i < 500; i += 1) {
      expect(await checkoutRateLimit(req(), 'order_create', 1)).toBeNull();
    }
  });
});
