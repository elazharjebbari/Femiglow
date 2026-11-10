// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PRICE_QUOTE_TTL_MS, signPriceQuote, verifyPriceQuote } from './price-quote';

const SKU = 'FEMI-KIT-100';
const NOW = Date.UTC(2026, 10, 10, 12, 0, 0);
const base = { sku: SKU, unit: 19900, cur: 'MAD', save: 9000, cpn: null, base: 28900, promo: 19900 };

describe('devis de prix signé', () => {
  beforeEach(() => {
    vi.stubEnv('PRICE_QUOTE_SECRET', 'x'.repeat(40));
  });
  afterEach(() => vi.unstubAllEnvs());

  it('aller-retour : le devis signé se vérifie et rend le prix', () => {
    const token = signPriceQuote(base, NOW)!;
    expect(token).toMatch(/^[\w-]+\.[\w-]+$/);
    const q = verifyPriceQuote(token, { sku: SKU, currency: 'MAD' }, NOW + 1000);
    expect(q).toMatchObject({ unit: 19900, save: 9000, sku: SKU, cur: 'MAD' });
  });

  it('expire après 6 h', () => {
    expect(PRICE_QUOTE_TTL_MS).toBe(6 * 60 * 60 * 1000);
    const token = signPriceQuote(base, NOW)!;
    expect(verifyPriceQuote(token, { sku: SKU, currency: 'MAD' }, NOW + PRICE_QUOTE_TTL_MS - 1)).not.toBeNull();
    expect(verifyPriceQuote(token, { sku: SKU, currency: 'MAD' }, NOW + PRICE_QUOTE_TTL_MS)).toBeNull();
  });

  it('refusé pour un autre SKU ou une autre devise', () => {
    const token = signPriceQuote(base, NOW)!;
    expect(verifyPriceQuote(token, { sku: 'AUTRE', currency: 'MAD' }, NOW)).toBeNull();
    expect(verifyPriceQuote(token, { sku: SKU, currency: 'EUR' }, NOW)).toBeNull();
  });

  it('un prix modifié par le client est refusé (signature invalide)', () => {
    const token = signPriceQuote(base, NOW)!;
    const [payload, sig] = token.split('.');
    const forged = JSON.parse(Buffer.from(payload!, 'base64url').toString());
    forged.unit = 100;
    const forgedPayload = Buffer.from(JSON.stringify(forged)).toString('base64url');
    expect(verifyPriceQuote(`${forgedPayload}.${sig}`, { sku: SKU, currency: 'MAD' }, NOW)).toBeNull();
  });

  it('signature faite avec un autre secret : refusée', () => {
    const token = signPriceQuote(base, NOW)!;
    vi.stubEnv('PRICE_QUOTE_SECRET', 'y'.repeat(40));
    expect(verifyPriceQuote(token, { sku: SKU, currency: 'MAD' }, NOW)).toBeNull();
  });

  it('entrées malformées : null sans exception', () => {
    for (const bad of [undefined, null, '', 'abc', 'a.b.c', '.', 'x'.repeat(2000), '%%%.%%%']) {
      expect(verifyPriceQuote(bad as string, { sku: SKU, currency: 'MAD' }, NOW)).toBeNull();
    }
  });

  it('sans PRICE_QUOTE_SECRET : pas de devis ni accepté, aucun repli sur les autres secrets', () => {
    const token = signPriceQuote(base, NOW)!;
    vi.stubEnv('PRICE_QUOTE_SECRET', '');
    vi.stubEnv('CRON_SECRET', 'z'.repeat(40));
    vi.stubEnv('WEBHOOK_SECRET_KEY', 'w'.repeat(40));
    expect(signPriceQuote(base, NOW)).toBeNull();
    expect(verifyPriceQuote(token, { sku: SKU, currency: 'MAD' }, NOW)).toBeNull();
  });

  it('secret trop court (< 32) : désactivé', () => {
    vi.stubEnv('PRICE_QUOTE_SECRET', 'court');
    expect(signPriceQuote(base, NOW)).toBeNull();
  });

  it('prix nul signé : refusé', () => {
    const token = signPriceQuote({ ...base, unit: 0 }, NOW)!;
    expect(verifyPriceQuote(token, { sku: SKU, currency: 'MAD' }, NOW)).toBeNull();
  });
});
