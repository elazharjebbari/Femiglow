/**
 * Tests `subProductSchema` étendu (phase 1 — refonte composition Kolenda).
 *
 * Couvre les contraintes des 3 nouveaux champs optionnels :
 *  - `sensation` (1-80 chars + ponctuation finale obligatoire),
 *  - `contextualImage` (même schema que `image`),
 *  - `accentColor` enum strict.
 *
 * Vérifie aussi la rétrocompatibilité : un sub-produit pré-refonte
 * (sans aucun des 3 nouveaux champs) reste valide.
 *
 * cf. docs/composition-reveal-optim-2026-05/03-data-model.md
 */
import { describe, expect, it } from 'vitest';

import { subProductSchema, type SubProduct } from './product';

function makeValidPayload(overrides: Partial<SubProduct> = {}): Record<string, unknown> {
  return {
    id: '1-paste',
    name: 'Paste',
    shortDescription: 'Crème onctueuse, sauge verte.',
    volume: '15 g',
    image: {
      src: '/paste.svg',
      alt: 'Pot Paste FemiGlow',
      width: 800,
      height: 1000,
    },
    ingredients: [
      {
        name: 'Cera Alba',
        inci: 'Cera Alba',
        function: 'filmogène',
        origin: 'Atlas',
      },
    ],
    certifications: [{ label: 'Halal', body: 'Halal Cosmetics Council' }],
    ...overrides,
  };
}

describe('subProductSchema — rétrocompatibilité', () => {
  it('accepte un sub-produit pré-refonte (sans sensation / accentColor / contextualImage)', () => {
    const parsed = subProductSchema.parse(makeValidPayload());
    expect(parsed.sensation).toBeUndefined();
    expect(parsed.accentColor).toBeUndefined();
    expect(parsed.contextualImage).toBeUndefined();
  });
});

describe('subProductSchema — sensation', () => {
  it('accepte une sensation terminée par un point', () => {
    const parsed = subProductSchema.parse(
      makeValidPayload({ sensation: 'Tiède au contact.' }),
    );
    expect(parsed.sensation).toBe('Tiède au contact.');
  });

  it('accepte une sensation terminée par un point d\'exclamation', () => {
    const parsed = subProductSchema.parse(
      makeValidPayload({ sensation: 'Quelle douceur !' }),
    );
    expect(parsed.sensation).toBe('Quelle douceur !');
  });

  it('accepte une sensation terminée par un guillemet français »', () => {
    const parsed = subProductSchema.parse(
      makeValidPayload({ sensation: '« Une note de chaleur »' }),
    );
    expect(parsed.sensation).toBe('« Une note de chaleur »');
  });

  it('rejette une sensation sans ponctuation finale', () => {
    expect(() =>
      subProductSchema.parse(makeValidPayload({ sensation: 'Tiède au contact' as never })),
    ).toThrow(/ponctuation/);
  });

  it('rejette une sensation vide', () => {
    expect(() =>
      subProductSchema.parse(makeValidPayload({ sensation: '' as never })),
    ).toThrow();
  });

  it('rejette une sensation > 80 caractères', () => {
    expect(() =>
      subProductSchema.parse(makeValidPayload({ sensation: ('x'.repeat(82) + '.') as never })),
    ).toThrow();
  });

  it('trim les espaces périphériques', () => {
    const parsed = subProductSchema.parse(
      makeValidPayload({ sensation: '   Tiède.   ' as never }),
    );
    expect(parsed.sensation).toBe('Tiède.');
  });
});

describe('subProductSchema — accentColor', () => {
  it('accepte sauge', () => {
    expect(
      subProductSchema.parse(makeValidPayload({ accentColor: 'sauge' })).accentColor,
    ).toBe('sauge');
  });

  it('accepte petale, ciel, champagne', () => {
    for (const color of ['petale', 'ciel', 'champagne'] as const) {
      expect(subProductSchema.parse(makeValidPayload({ accentColor: color })).accentColor).toBe(color);
    }
  });

  it('rejette une couleur hors enum', () => {
    expect(() =>
      subProductSchema.parse(makeValidPayload({ accentColor: 'rouge' as never })),
    ).toThrow();
  });
});

describe('subProductSchema — contextualImage', () => {
  it('accepte une image contextuelle valide', () => {
    const ctx = {
      src: '/paste-context.jpg',
      alt: 'Main qui prend la paste',
      width: 1200,
      height: 1500,
    };
    expect(
      subProductSchema.parse(makeValidPayload({ contextualImage: ctx as never }))
        .contextualImage,
    ).toEqual(ctx);
  });

  it('rejette une image contextuelle sans alt', () => {
    const bad = { src: '/x.jpg', width: 1, height: 1 } as unknown;
    expect(() =>
      subProductSchema.parse(makeValidPayload({ contextualImage: bad as never })),
    ).toThrow();
  });
});
