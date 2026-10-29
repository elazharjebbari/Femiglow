import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/coupons/promo-code', () => ({ validatePromoCode: vi.fn() }));
vi.mock('@/lib/products/public', () => ({ getKitLeadValue: vi.fn() }));

import { validatePromoCode } from '@/lib/coupons/promo-code';
import { getKitLeadValue } from '@/lib/products/public';
import {
  __resetChatPromoCache,
  buildChatPromo,
  buildPromoPromptBlock,
  formatPromoEnd,
  getChatPromo,
  hasPromoTokens,
  renderPromoTokens,
} from './promo-offer';

const END = new Date('2026-11-30T22:59:59Z');
const PROMO = buildChatPromo({
  code: 'glow99',
  listPriceMad: 199,
  discountCents: 10000,
  currency: 'MAD',
  endsAt: END,
});

describe('buildChatPromo', () => {
  it('calcule le prix remisé et normalise le code', () => {
    expect(PROMO).toEqual({
      code: 'GLOW99',
      listPriceMad: 199,
      promoPriceMad: 99,
      discountMad: 100,
      currency: 'MAD',
      endsAt: END,
    });
  });
  it('refuse une remise nulle ou qui rend le prix nul', () => {
    expect(buildChatPromo({ code: 'X', listPriceMad: 199, discountCents: 0, currency: 'MAD', endsAt: null })).toBeNull();
    expect(buildChatPromo({ code: 'X', listPriceMad: 99, discountCents: 10000, currency: 'MAD', endsAt: null })).toBeNull();
  });
});

describe('formatPromoEnd', () => {
  it('affiche la date au fuseau du Maroc (23:59 le 30, pas le 1er décembre)', () => {
    expect(formatPromoEnd(END, 'fr')).toBe('30 novembre');
    expect(formatPromoEnd(END, 'ar')).toMatch(/^30 /);
    expect(formatPromoEnd(null, 'fr')).toBeNull();
  });
});

describe('renderPromoTokens', () => {
  const tpl = 'Avec le code {{promo_code}}, le Pack passe de {{list_price}} dh à {{promo_price}} dh ({{promo_discount}} dh de remise) jusqu’au {{promo_end}}.';

  it('rend tous les jetons', () => {
    expect(renderPromoTokens(tpl, PROMO, 'fr')).toEqual({
      text: 'Avec le code GLOW99, le Pack passe de 199 dh à 99 dh (100 dh de remise) jusqu’au 30 novembre.',
      ok: true,
      usedTokens: true,
    });
  });
  it('écarte un texte à jetons sans offre active', () => {
    expect(renderPromoTokens(tpl, null, 'fr').ok).toBe(false);
  });
  it('laisse passer un texte sans jeton, avec ou sans offre', () => {
    expect(renderPromoTokens('Paiement à la livraison.', null, 'fr')).toEqual({
      text: 'Paiement à la livraison.',
      ok: true,
      usedTokens: false,
    });
  });
  it('refuse {{promo_end}} quand le coupon n’a pas de date de fin', () => {
    const noEnd = { ...PROMO!, endsAt: null };
    expect(renderPromoTokens('jusqu’au {{promo_end}}', noEnd, 'fr').ok).toBe(false);
    expect(renderPromoTokens('code {{promo_code}}', noEnd, 'fr').ok).toBe(true);
  });
  it('détecte les jetons avec espaces', () => {
    expect(hasPromoTokens('{{ promo_price }}')).toBe(true);
    expect(hasPromoTokens('{{autre}}')).toBe(false);
  });
});

describe('buildPromoPromptBlock', () => {
  it.each(['fr', 'ar', 'ar-MA'] as const)('cite le code et les deux prix (%s)', (lang) => {
    const block = buildPromoPromptBlock(PROMO, lang);
    expect(block).toContain('GLOW99');
    expect(block).toContain('99');
    expect(block).toContain('199');
  });
  it.each(['fr', 'ar', 'ar-MA'] as const)('sans offre : aucun code, consigne de ne pas en inventer (%s)', (lang) => {
    const block = buildPromoPromptBlock(null, lang);
    expect(block).not.toContain('GLOW99');
    expect(block.length).toBeGreaterThan(20);
  });
});

describe('getChatPromo', () => {
  beforeEach(() => {
    __resetChatPromoCache();
    vi.mocked(validatePromoCode).mockReset();
    vi.mocked(getKitLeadValue).mockResolvedValue({ value: 199, currency: 'MAD' });
  });

  it('offre active quand le coupon est valide', async () => {
    vi.mocked(validatePromoCode).mockResolvedValue({
      valid: true,
      valueCents: 10000,
      coupon: { endsAt: END } as never,
    });
    await expect(getChatPromo()).resolves.toMatchObject({ code: 'GLOW99', promoPriceMad: 99 });
  });

  it.each(['expired', 'cap_reached', 'inactive', 'not_found'] as const)('aucune offre si le coupon est %s', async (reason) => {
    vi.mocked(validatePromoCode).mockResolvedValue({ valid: false, reason });
    await expect(getChatPromo()).resolves.toBeNull();
  });

  it('fail-soft : une erreur DB donne « pas d’offre », jamais une offre inventée', async () => {
    vi.mocked(validatePromoCode).mockRejectedValue(new Error('db down'));
    await expect(getChatPromo()).resolves.toBeNull();
  });

  it('met en cache 60 s', async () => {
    vi.mocked(validatePromoCode).mockResolvedValue({ valid: false, reason: 'expired' });
    const t0 = new Date('2026-11-01T10:00:00Z');
    await getChatPromo(t0);
    await getChatPromo(new Date(t0.getTime() + 30_000));
    expect(validatePromoCode).toHaveBeenCalledTimes(1);
    await getChatPromo(new Date(t0.getTime() + 61_000));
    expect(validatePromoCode).toHaveBeenCalledTimes(2);
  });
});
