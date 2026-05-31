/**
 * Boundary value testing — chaque schéma Zod et chaque guard métier
 * testé à l'exacte limite (n-1, n, n+1).
 *
 * Couvre :
 *  - legalSlugSchema : 2/80/81 chars, charset
 *  - title : 3/200/201 (via legalPageDraftInputSchema)
 *  - description : 0/200/201
 *  - bodyMd : 10/9 chars (min)
 *  - templateVarKey : 2/40/41 chars, charset
 *  - canonical URL : valid / invalid
 *  - locale : 'fr-MA' / 'ar-MA' / autres rejetés
 */
import { describe, expect, it } from 'vitest';

import {
  legalLocaleSchema,
  legalPageDraftInputSchema,
  legalPageStatusSchema,
  legalPageUpdateInputSchema,
  legalSlugSchema,
  legalTemplateVarKeySchema,
  legalZoneKeySchema,
} from './types';

// ───────────────────────────────────────────────────────────────────────
//  legalSlugSchema
// ───────────────────────────────────────────────────────────────────────

describe('legalSlugSchema — boundary length', () => {
  it('accepte exactement 2 chars (min)', () => {
    expect(legalSlugSchema.safeParse('ab').success).toBe(true);
  });

  it('refuse exactement 1 char (min - 1)', () => {
    expect(legalSlugSchema.safeParse('a').success).toBe(false);
  });

  it('accepte exactement 80 chars (max)', () => {
    expect(legalSlugSchema.safeParse('a'.repeat(80)).success).toBe(true);
  });

  it('refuse exactement 81 chars (max + 1)', () => {
    expect(legalSlugSchema.safeParse('a'.repeat(81)).success).toBe(false);
  });
});

describe('legalSlugSchema — charset', () => {
  it('refuse caractère vide ""', () => {
    expect(legalSlugSchema.safeParse('').success).toBe(false);
  });

  it.each([
    ['UPPER', false],
    ['mixed-CASE', false],
    ['has space', false],
    ['has_underscore', false],
    ['has.dot', false],
    ['has/slash', false],
    ['emoji-✨', false],
    ['accents-éà', false],
    ['arabic-ك', false],
    ['valid-slug', true],
    ['12-345', true],
    ['only-letters', true],
    ['only9-digits-2026', true],
    ['---', true], // pattern allow consecutive dashes
  ])('charset "%s" → success=%s', (input, expected) => {
    expect(legalSlugSchema.safeParse(input).success).toBe(expected);
  });
});

// ───────────────────────────────────────────────────────────────────────
//  legalPageDraftInputSchema — title/description/bodyMd
// ───────────────────────────────────────────────────────────────────────

describe('legalPageDraftInputSchema — title boundary', () => {
  const base = { slug: 'valid-slug', bodyMd: 'x'.repeat(20) };

  it('title exactement 3 chars passe', () => {
    expect(legalPageDraftInputSchema.safeParse({ ...base, title: 'abc' }).success).toBe(true);
  });

  it('title 2 chars échoue', () => {
    expect(legalPageDraftInputSchema.safeParse({ ...base, title: 'ab' }).success).toBe(false);
  });

  it('title exactement 200 chars passe', () => {
    expect(
      legalPageDraftInputSchema.safeParse({ ...base, title: 'a'.repeat(200) }).success,
    ).toBe(true);
  });

  it('title 201 chars échoue', () => {
    expect(
      legalPageDraftInputSchema.safeParse({ ...base, title: 'a'.repeat(201) }).success,
    ).toBe(false);
  });
});

describe('legalPageDraftInputSchema — bodyMd boundary', () => {
  const base = { slug: 'valid', title: 'Title' };

  it('bodyMd 10 chars passe', () => {
    expect(legalPageDraftInputSchema.safeParse({ ...base, bodyMd: 'a'.repeat(10) }).success).toBe(
      true,
    );
  });

  it('bodyMd 9 chars échoue', () => {
    expect(legalPageDraftInputSchema.safeParse({ ...base, bodyMd: 'a'.repeat(9) }).success).toBe(
      false,
    );
  });

  it('bodyMd vide échoue', () => {
    expect(legalPageDraftInputSchema.safeParse({ ...base, bodyMd: '' }).success).toBe(false);
  });
});

describe('legalPageDraftInputSchema — description boundary', () => {
  const base = { slug: 'valid', title: 'Title', bodyMd: 'x'.repeat(20) };

  it('description vide non fourni → OK (optional)', () => {
    expect(legalPageDraftInputSchema.safeParse(base).success).toBe(true);
  });

  it('description null → OK', () => {
    expect(
      legalPageDraftInputSchema.safeParse({ ...base, description: null }).success,
    ).toBe(true);
  });

  it('description 200 chars passe', () => {
    expect(
      legalPageDraftInputSchema.safeParse({ ...base, description: 'a'.repeat(200) }).success,
    ).toBe(true);
  });

  it('description 201 chars échoue', () => {
    expect(
      legalPageDraftInputSchema.safeParse({ ...base, description: 'a'.repeat(201) }).success,
    ).toBe(false);
  });
});

describe('legalPageDraftInputSchema — canonicalUrl', () => {
  const base = { slug: 'valid', title: 'Title', bodyMd: 'x'.repeat(20) };

  it('canonicalUrl valid HTTPS URL passe', () => {
    expect(
      legalPageDraftInputSchema.safeParse({
        ...base,
        canonicalUrl: 'https://example.com/legal/cgv',
      }).success,
    ).toBe(true);
  });

  it('canonicalUrl "not-a-url" échoue', () => {
    expect(
      legalPageDraftInputSchema.safeParse({ ...base, canonicalUrl: 'not-a-url' }).success,
    ).toBe(false);
  });

  it('canonicalUrl null passe (optional)', () => {
    expect(
      legalPageDraftInputSchema.safeParse({ ...base, canonicalUrl: null }).success,
    ).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────
//  legalTemplateVarKeySchema
// ───────────────────────────────────────────────────────────────────────

describe('legalTemplateVarKeySchema — boundary', () => {
  it('2 chars (min) passe', () => {
    expect(legalTemplateVarKeySchema.safeParse('AB').success).toBe(true);
  });

  it('1 char échoue', () => {
    expect(legalTemplateVarKeySchema.safeParse('A').success).toBe(false);
  });

  it('40 chars (max) passe', () => {
    expect(legalTemplateVarKeySchema.safeParse('A'.repeat(40)).success).toBe(true);
  });

  it('41 chars échoue', () => {
    expect(legalTemplateVarKeySchema.safeParse('A'.repeat(41)).success).toBe(false);
  });

  it.each([
    ['COMPANY_NAME', true],
    ['ICE', true],
    ['A1_B2', true],
    ['1A_VAR', false], // ne commence pas par lettre
    ['_PRIVATE', false], // commence par underscore
    ['lowerName', false],
    ['HAS-DASH', false],
    ['HAS.DOT', false],
    ['HAS SPACE', false],
  ])('charset "%s" → %s', (input, expected) => {
    expect(legalTemplateVarKeySchema.safeParse(input).success).toBe(expected);
  });
});

// ───────────────────────────────────────────────────────────────────────
//  legalZoneKeySchema (similaire mais avec dash autorisés)
// ───────────────────────────────────────────────────────────────────────

describe('legalZoneKeySchema — boundary', () => {
  it.each([
    ['ab', true],
    ['a', false],
    ['a'.repeat(50), true],
    ['a'.repeat(51), false],
    ['footer-main', true],
    ['cookie-banner-links', true],
    ['UPPER', false],
    ['has_underscore', false],
    ['has space', false],
  ])('"%s" → %s', (input, expected) => {
    expect(legalZoneKeySchema.safeParse(input).success).toBe(expected);
  });
});

// ───────────────────────────────────────────────────────────────────────
//  legalLocaleSchema
// ───────────────────────────────────────────────────────────────────────

describe('legalLocaleSchema', () => {
  it.each([
    ['fr-MA', true],
    ['ar-MA', true],
    ['fr-FR', false],
    ['en-US', false],
    ['ar', false],
    ['fr', false],
    ['', false],
  ])('"%s" → %s', (input, expected) => {
    expect(legalLocaleSchema.safeParse(input).success).toBe(expected);
  });
});

// ───────────────────────────────────────────────────────────────────────
//  legalPageStatusSchema
// ───────────────────────────────────────────────────────────────────────

describe('legalPageStatusSchema', () => {
  it.each([
    ['draft', true],
    ['review', true],
    ['published', true],
    ['archived', true],
    ['Draft', false],
    ['DRAFT', false],
    ['pending', false],
    ['', false],
  ])('"%s" → %s', (input, expected) => {
    expect(legalPageStatusSchema.safeParse(input).success).toBe(expected);
  });
});

// ───────────────────────────────────────────────────────────────────────
//  legalPageUpdateInputSchema — partial update
// ───────────────────────────────────────────────────────────────────────

describe('legalPageUpdateInputSchema — partial', () => {
  it('object vide passe (toutes les keys optional)', () => {
    expect(legalPageUpdateInputSchema.safeParse({}).success).toBe(true);
  });

  it('title undefined ignoré (vs title null)', () => {
    expect(legalPageUpdateInputSchema.safeParse({ title: undefined }).success).toBe(true);
  });

  it('title null échoue (pas nullable)', () => {
    expect(legalPageUpdateInputSchema.safeParse({ title: null }).success).toBe(false);
  });

  it('description null passe', () => {
    expect(legalPageUpdateInputSchema.safeParse({ description: null }).success).toBe(true);
  });

  it('bodyMd 9 chars échoue', () => {
    expect(legalPageUpdateInputSchema.safeParse({ bodyMd: 'a'.repeat(9) }).success).toBe(false);
  });
});
