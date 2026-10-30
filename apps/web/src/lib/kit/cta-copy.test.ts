/**
 * Tests du gabarit des boutons de commande (Kit CRO v2 §4).
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_KIT_CTA_COPY, formatCtaLabel, formatCtaPrice } from './cta-copy';

describe('formatCtaLabel', () => {
  it('remplit {price}', () => {
    expect(formatCtaLabel('Je commande — {price}', '99 DH')).toBe('Je commande — 99 DH');
    expect(formatCtaLabel('اطلبي الآن — {price}', '99 درهم')).toBe('اطلبي الآن — 99 درهم');
    expect(formatCtaLabel('Order now — {price}', '199 MAD')).toBe('Order now — 199 MAD');
  });

  it('remplace toutes les occurrences', () => {
    expect(formatCtaLabel('{price} : je commande à {price}', '99 DH')).toBe(
      '99 DH : je commande à 99 DH',
    );
  });

  it('gabarit sans {price} : renvoyé tel quel', () => {
    expect(formatCtaLabel('Je commande', '99 DH')).toBe('Je commande');
    expect(formatCtaLabel('Je commande', null)).toBe('Je commande');
    expect(formatCtaLabel('  Espaces gardés  ', null)).toBe('  Espaces gardés  ');
  });

  it('prix inconnu : retire proprement le segment « — {price} »', () => {
    expect(formatCtaLabel('Je commande — {price}', null)).toBe('Je commande');
    expect(formatCtaLabel('Je commande – {price}', undefined)).toBe('Je commande');
    expect(formatCtaLabel('Je commande - {price}', '')).toBe('Je commande');
    expect(formatCtaLabel('Je commande : {price}', '   ')).toBe('Je commande');
    expect(formatCtaLabel('اطلبي الآن — {price}', null)).toBe('اطلبي الآن');
  });

  it('prix inconnu, jeton en tête ou au milieu', () => {
    expect(formatCtaLabel('{price} — je commande', null)).toBe('je commande');
    expect(formatCtaLabel('Je commande {price} maintenant', null)).toBe('Je commande maintenant');
    expect(formatCtaLabel('{price}', null)).toBe('');
  });
});

describe('formatCtaPrice', () => {
  it('unité selon la locale (MAD)', () => {
    expect(formatCtaPrice(9900, 'MAD', 'fr')).toBe('99 DH');
    expect(formatCtaPrice(19900, 'MAD', 'en')).toBe('199 MAD');
    expect(formatCtaPrice(9900, 'MAD', 'ar')).toBe('99 درهم');
  });

  it('défauts : MAD, FR', () => {
    expect(formatCtaPrice(9900)).toBe('99 DH');
  });

  it('autre devise : code affiché', () => {
    expect(formatCtaPrice(3500, 'EUR', 'fr')).toBe('35 EUR');
  });

  it('montant non entier : deux décimales (virgule en FR)', () => {
    expect(formatCtaPrice(9950, 'MAD', 'fr')).toBe('99,50 DH');
    expect(formatCtaPrice(9950, 'MAD', 'en')).toBe('99.50 MAD');
  });

  it('zéro est un prix valide', () => {
    expect(formatCtaPrice(0, 'MAD', 'fr')).toBe('0 DH');
  });

  it('prix inconnu ou invalide → null', () => {
    expect(formatCtaPrice(undefined)).toBeNull();
    expect(formatCtaPrice(null)).toBeNull();
    expect(formatCtaPrice(Number.NaN)).toBeNull();
    expect(formatCtaPrice(-100)).toBeNull();
  });
});

describe('DEFAULT_KIT_CTA_COPY', () => {
  it('reprend les libellés FR du registre et des messages', () => {
    expect(DEFAULT_KIT_CTA_COPY).toEqual({
      primary: 'Je commande — {price}',
      sticky: 'Je commande',
      microcopy: 'Je paie à la livraison',
      pack: 'Je commande — {price}',
    });
  });
});
