/**
 * Tests des extensions composition sur `ingredientDetailedSchema` et
 * `subProductSchema` (Phase 1 — narrative, usageHint, inciDefinition).
 */
import { describe, expect, it } from 'vitest';

import { ingredientDetailedSchema, subProductSchema } from './product';
import { mockKitPageContent } from '@/data/mock/kit';

const baseIngredient = {
  name: 'Cire d’abeille',
  inci: 'Cera Alba',
  function: 'Filmogène naturel',
  origin: 'Coopérative apicole, Atlas marocain',
};

const baseSubProduct = {
  id: '1-paste',
  name: '1 Paste',
  shortDescription: 'Pâte crème onctueuse. Une noisette suffit.',
  volume: '15 g',
  image: { src: '/p.svg', alt: 'p', width: 1200, height: 1500 },
  ingredients: [{ ...baseIngredient }],
  certifications: [{ label: 'Cosmos Organic', body: 'Ecocert' }],
};

describe('ingredientDetailedSchema — inciDefinition', () => {
  it('accepte un ingredient sans inciDefinition (rétro-compat)', () => {
    expect(ingredientDetailedSchema.safeParse(baseIngredient).success).toBe(true);
  });

  it('accepte un inciDefinition court (≤ 200 chars)', () => {
    const r = ingredientDetailedSchema.safeParse({
      ...baseIngredient,
      inciDefinition: 'Nom officiel de la cire d’abeille pure. Filme l’ongle sans le sceller.',
    });
    expect(r.success).toBe(true);
  });

  it('refuse un inciDefinition > 200 chars', () => {
    const r = ingredientDetailedSchema.safeParse({
      ...baseIngredient,
      inciDefinition: 'x'.repeat(201),
    });
    expect(r.success).toBe(false);
  });

  it('refuse un inciDefinition vide', () => {
    const r = ingredientDetailedSchema.safeParse({
      ...baseIngredient,
      inciDefinition: '   ',
    });
    expect(r.success).toBe(false);
  });
});

describe('subProductSchema — narrative', () => {
  it('accepte un SubProduct sans narrative (rétro-compat)', () => {
    expect(subProductSchema.safeParse(baseSubProduct).success).toBe(true);
  });

  it('accepte une narrative valide terminée par un point', () => {
    const r = subProductSchema.safeParse({
      ...baseSubProduct,
      narrative: '12 % de cire d’abeille fondue à basse température. Une noisette filme dix doigts.',
    });
    expect(r.success).toBe(true);
  });

  it('refuse une narrative sans ponctuation finale', () => {
    const r = subProductSchema.safeParse({
      ...baseSubProduct,
      narrative: '12 % de cire d’abeille fondue à basse température',
    });
    expect(r.success).toBe(false);
  });

  it('refuse une narrative > 320 chars', () => {
    const r = subProductSchema.safeParse({
      ...baseSubProduct,
      narrative: `${'x'.repeat(320)}.`,
    });
    expect(r.success).toBe(false);
  });

  it('refuse une narrative vide après trim', () => {
    const r = subProductSchema.safeParse({
      ...baseSubProduct,
      narrative: '   ',
    });
    expect(r.success).toBe(false);
  });
});

describe('subProductSchema — usageHint', () => {
  it('accepte un SubProduct sans usageHint (rétro-compat)', () => {
    expect(subProductSchema.safeParse(baseSubProduct).success).toBe(true);
  });

  it('accepte un usageHint court', () => {
    const r = subProductSchema.safeParse({
      ...baseSubProduct,
      usageHint: 'une noisette filme dix doigts',
    });
    expect(r.success).toBe(true);
  });

  it('refuse un usageHint > 60 chars', () => {
    const r = subProductSchema.safeParse({
      ...baseSubProduct,
      usageHint: 'x'.repeat(61),
    });
    expect(r.success).toBe(false);
  });

  it('refuse un usageHint vide après trim', () => {
    const r = subProductSchema.safeParse({
      ...baseSubProduct,
      usageHint: '   ',
    });
    expect(r.success).toBe(false);
  });
});

describe('mockKitPageContent — Phase 1 enrichissement', () => {
  it('chaque sous-produit a une narrative valide', () => {
    for (const sub of mockKitPageContent.composition) {
      expect(sub.narrative, `narrative manquante pour ${sub.id}`).toBeDefined();
      expect(sub.narrative!.length).toBeLessThanOrEqual(320);
      expect(sub.narrative!).toMatch(/[.!?»]$/);
    }
  });

  it('chaque sous-produit a un usageHint valide', () => {
    for (const sub of mockKitPageContent.composition) {
      expect(sub.usageHint, `usageHint manquant pour ${sub.id}`).toBeDefined();
      expect(sub.usageHint!.length).toBeLessThanOrEqual(60);
    }
  });

  it('chaque ingrédient a une inciDefinition (couverture totale)', () => {
    const totalIngredients = mockKitPageContent.composition.reduce(
      (sum, sub) => sum + sub.ingredients.length,
      0,
    );
    const totalDefs = mockKitPageContent.composition.reduce(
      (sum, sub) => sum + sub.ingredients.filter((i) => i.inciDefinition).length,
      0,
    );
    expect(totalDefs).toBe(totalIngredients);
  });
});
