import { describe, expect, it } from 'vitest';

import { patchLeadAddressDraftInputSchema as schema } from './lead';

describe('patchLeadAddressDraftInputSchema', () => {
  it('accepte un seul champ', () => {
    expect(schema.safeParse({ city: 'Casablanca' }).success).toBe(true);
    expect(schema.safeParse({ addressLine1: 'Hay Salam' }).success).toBe(true);
    expect(schema.safeParse({ notes: 'Près de la mosquée' }).success).toBe(true);
  });

  it('une chaîne vide efface l’adresse, jamais la ville', () => {
    expect(schema.safeParse({ addressLine1: '' }).success).toBe(true);
    expect(schema.safeParse({ city: '' }).success).toBe(false);
    expect(schema.safeParse({ city: ' a ' }).success).toBe(false);
  });

  it('refuse un envoi vide et tout champ inconnu', () => {
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ city: 'Fès', purchasedAt: 'x' }).success).toBe(false);
    expect(schema.safeParse({ city: 'Fès', addressCompletedAt: 'x' }).success).toBe(false);
  });

  it('borne les longueurs', () => {
    expect(schema.safeParse({ city: 'a'.repeat(81) }).success).toBe(false);
    expect(schema.safeParse({ addressLine1: 'a'.repeat(161) }).success).toBe(false);
    expect(schema.safeParse({ notes: 'a'.repeat(501) }).success).toBe(false);
  });
});
