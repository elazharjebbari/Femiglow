import { describe, expect, it } from 'vitest';
import {
  RITUAL_CITY_CATALOG,
  RITUAL_TAG_CATALOG,
  RitualAdminActionSchema,
  RitualCitySchema,
  RitualListQuerySchema,
  RitualSignalSchema,
  RitualTagSchema,
  RitualTestimonialSubmitSchema,
} from './rituals';

describe('RitualSignalSchema', () => {
  it('accepte oui / hesite / non', () => {
    for (const v of ['oui', 'hesite', 'non'] as const) {
      expect(RitualSignalSchema.parse(v)).toBe(v);
    }
  });
  it('rejette une valeur inconnue', () => {
    expect(RitualSignalSchema.safeParse('maybe').success).toBe(false);
  });
});

describe('RitualTagSchema', () => {
  it('accepte tous les tags du catalogue', () => {
    for (const t of RITUAL_TAG_CATALOG) {
      expect(RitualTagSchema.safeParse(t).success).toBe(true);
    }
  });
  it('rejette un tag inconnu', () => {
    expect(RitualTagSchema.safeParse('miracle').success).toBe(false);
  });
});

describe('RitualCitySchema', () => {
  it('accepte toutes les villes', () => {
    for (const c of RITUAL_CITY_CATALOG) {
      expect(RitualCitySchema.safeParse(c).success).toBe(true);
    }
  });
});

describe('RitualTestimonialSubmitSchema', () => {
  const base = {
    productKey: 'pack-femiglow',
    body: 'a'.repeat(60),
    wouldRecommend: 'oui' as const,
  };

  it('accepte un payload minimal valide', () => {
    expect(RitualTestimonialSubmitSchema.safeParse(base).success).toBe(true);
  });

  it('rejette un body trop court', () => {
    expect(
      RitualTestimonialSubmitSchema.safeParse({ ...base, body: 'court' }).success,
    ).toBe(false);
  });

  it('rejette un body trop long', () => {
    expect(
      RitualTestimonialSubmitSchema.safeParse({ ...base, body: 'a'.repeat(601) })
        .success,
    ).toBe(false);
  });

  it('rejette un wouldRecommend invalide', () => {
    expect(
      RitualTestimonialSubmitSchema.safeParse({ ...base, wouldRecommend: 'maybe' })
        .success,
    ).toBe(false);
  });

  it('accepte ritualTags max 3', () => {
    expect(
      RitualTestimonialSubmitSchema.safeParse({
        ...base,
        ritualTags: ['ongles-plus-lisses', 'plaque-souple', 'halal'],
      }).success,
    ).toBe(true);
  });

  it('rejette 4 ritualTags', () => {
    expect(
      RitualTestimonialSubmitSchema.safeParse({
        ...base,
        ritualTags: [
          'ongles-plus-lisses',
          'plaque-souple',
          'cuticules-apaisees',
          'plus-de-casse',
        ],
      }).success,
    ).toBe(false);
  });

  it('rejette photo > 5 Mo', () => {
    expect(
      RitualTestimonialSubmitSchema.safeParse({
        ...base,
        photos: [
          {
            blobKey: 'x',
            width: 800,
            height: 1000,
            byteSize: 6 * 1024 * 1024,
            mime: 'image/jpeg',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('accepte initiatedSince au format YYYY-MM', () => {
    expect(
      RitualTestimonialSubmitSchema.safeParse({ ...base, initiatedSince: '2026-02' }).success,
    ).toBe(true);
  });

  it('rejette initiatedSince mauvais format', () => {
    expect(
      RitualTestimonialSubmitSchema.safeParse({ ...base, initiatedSince: '2026/02' }).success,
    ).toBe(false);
  });

  it('applique anonymat par défaut à false', () => {
    const parsed = RitualTestimonialSubmitSchema.parse(base);
    expect(parsed.isAnonymous).toBe(false);
  });

  it('applique language par défaut à fr', () => {
    const parsed = RitualTestimonialSubmitSchema.parse(base);
    expect(parsed.language).toBe('fr');
  });
});

describe('RitualListQuerySchema', () => {
  it('limit par défaut 12', () => {
    const parsed = RitualListQuerySchema.parse({ productKey: 'pack-femiglow' });
    expect(parsed.limit).toBe(12);
    expect(parsed.sort).toBe('recommended');
  });

  it('rejette limit > 24', () => {
    expect(
      RitualListQuerySchema.safeParse({ productKey: 'k', limit: 25 }).success,
    ).toBe(false);
  });
});

describe('RitualAdminActionSchema', () => {
  it('approve sans note OK', () => {
    expect(RitualAdminActionSchema.safeParse({ action: 'approve' }).success).toBe(true);
  });

  it('reject sans note rejeté', () => {
    expect(RitualAdminActionSchema.safeParse({ action: 'reject' }).success).toBe(false);
  });

  it('correct exige newBody ≥ 50 et note', () => {
    expect(
      RitualAdminActionSchema.safeParse({
        action: 'correct',
        newBody: 'a'.repeat(60),
        note: 'coquille',
      }).success,
    ).toBe(true);

    expect(
      RitualAdminActionSchema.safeParse({
        action: 'correct',
        newBody: 'court',
        note: 'coquille',
      }).success,
    ).toBe(false);
  });
});
