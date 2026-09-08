/**
 * Résolution SERVEUR du code de campagne présent dans l'URL.
 *
 * L'oracle central est l'INVARIANCE : sans paramètre de code, la fonction ne
 * doit émettre AUCUNE requête (pas de latence, pas d'accès base) et renvoyer
 * `undefined` — la page d'une visiteuse normale ne paie rien.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveRedeemableCode = vi.hoisted(() => vi.fn());
vi.mock('@/lib/coupons/promo-code', () => ({ resolveRedeemableCode }));

import { readCouponSearchParam, resolveUrlCouponSeed } from './server-url-coupon';

beforeEach(() => {
  resolveRedeemableCode.mockReset();
});

describe('readCouponSearchParam', () => {
  it('lit code, promo ou coupon (dans cet ordre), trim + MAJUSCULES', () => {
    expect(readCouponSearchParam({ code: ' glow99 ' })).toBe('GLOW99');
    expect(readCouponSearchParam({ promo: 'fg-x123' })).toBe('FG-X123');
    expect(readCouponSearchParam({ coupon: 'abc' })).toBe('ABC');
    expect(readCouponSearchParam({ code: 'aaa', promo: 'bbb' })).toBe('AAA');
  });

  it('ignore les valeurs trop courtes, absentes ou non pertinentes', () => {
    expect(readCouponSearchParam({ code: 'ab' })).toBeNull();
    expect(readCouponSearchParam({})).toBeNull();
    expect(readCouponSearchParam(undefined)).toBeNull();
    expect(readCouponSearchParam({ layout: 'v2' } as never)).toBeNull();
  });

  it('tolère un paramètre répété (tableau) en prenant la première valeur', () => {
    expect(readCouponSearchParam({ code: ['glow99', 'autre'] })).toBe('GLOW99');
  });

  it('borne la longueur à 40 caractères', () => {
    expect(readCouponSearchParam({ code: 'x'.repeat(80) })).toHaveLength(40);
  });
});

describe('resolveUrlCouponSeed', () => {
  it('INVARIANCE — sans code dans l’URL, aucune requête et aucune graine', async () => {
    await expect(resolveUrlCouponSeed(undefined)).resolves.toBeUndefined();
    await expect(resolveUrlCouponSeed({})).resolves.toBeUndefined();
    await expect(resolveUrlCouponSeed({ layout: 'v2' } as never)).resolves.toBeUndefined();
    expect(resolveRedeemableCode).not.toHaveBeenCalled();
  });

  it('code valide → graine {code, valueCents, kind} normalisée', async () => {
    resolveRedeemableCode.mockResolvedValue({
      valid: true,
      kind: 'promo',
      code: 'GLOW99',
      valueCents: 10000,
      coupon: {},
    });
    await expect(resolveUrlCouponSeed({ code: 'glow99' })).resolves.toEqual({
      code: 'GLOW99',
      valueCents: 10000,
      kind: 'promo',
    });
    expect(resolveRedeemableCode).toHaveBeenCalledWith('GLOW99');
  });

  it('code refusé → pas de graine (la page reste au prix catalogue)', async () => {
    resolveRedeemableCode.mockResolvedValue({ valid: false, reason: 'not_found' });
    await expect(resolveUrlCouponSeed({ code: 'NOPE99' })).resolves.toBeUndefined();
  });

  it('montant nul → pas de graine (jamais de « −0 MAD »)', async () => {
    resolveRedeemableCode.mockResolvedValue({
      valid: true,
      kind: 'promo',
      code: 'ZERO',
      valueCents: 0,
      coupon: {},
    });
    await expect(resolveUrlCouponSeed({ code: 'ZERO99' })).resolves.toBeUndefined();
  });

  it('panne de résolution → pas de graine, jamais d’exception sur /kit', async () => {
    resolveRedeemableCode.mockRejectedValue(new Error('db down'));
    await expect(resolveUrlCouponSeed({ code: 'GLOW99' })).resolves.toBeUndefined();
  });
});
