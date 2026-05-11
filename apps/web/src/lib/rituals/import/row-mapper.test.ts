import { describe, expect, it } from 'vitest';
import { mapImportRow } from './row-mapper';

describe('mapImportRow', () => {
  it('row valide minimal', () => {
    const result = mapImportRow({
      body: 'a'.repeat(60),
      wouldRecommend: 'oui',
    });
    expect(result.errors).toHaveLength(0);
    expect(result.row?.wouldRecommend).toBe('oui');
  });

  it('ERROR si body manquant', () => {
    const result = mapImportRow({ wouldRecommend: 'oui' });
    expect(result.row).toBeNull();
    expect(result.errors.some((e) => e.field === 'body')).toBe(true);
  });

  it('ERROR si body trop court', () => {
    const result = mapImportRow({ body: 'court', wouldRecommend: 'oui' });
    expect(result.errors.some((e) => e.code === 'body_too_short')).toBe(true);
  });

  it('ERROR si signal inconnu', () => {
    const result = mapImportRow({ body: 'a'.repeat(60), wouldRecommend: 'maybeso' });
    expect(result.errors.some((e) => e.field === 'wouldRecommend')).toBe(true);
  });

  it('synonyme signal anglais oui', () => {
    const result = mapImportRow({ body: 'a'.repeat(60), wouldRecommend: 'yes' });
    expect(result.row?.wouldRecommend).toBe('oui');
  });

  it('synonyme signal long oui sans hésiter', () => {
    const result = mapImportRow({
      body: 'a'.repeat(60),
      wouldRecommend: 'Oui, sans hésiter',
    });
    expect(result.row?.wouldRecommend).toBe('oui');
  });

  it('tags séparés par virgule', () => {
    const result = mapImportRow({
      body: 'a'.repeat(60),
      wouldRecommend: 'oui',
      ritualTags: 'ongles-plus-lisses,plus-de-casse',
    });
    expect(result.row?.ritualTags).toEqual(['ongles-plus-lisses', 'plus-de-casse']);
  });

  it('tag inconnu → warning', () => {
    const result = mapImportRow({
      body: 'a'.repeat(60),
      wouldRecommend: 'oui',
      ritualTags: 'patience',
    });
    expect(result.row?.ritualTags).toEqual([]);
    expect(result.warnings.some((w) => w.code === 'tag_unknown')).toBe(true);
  });

  it('tags > 3 tronqués', () => {
    const result = mapImportRow({
      body: 'a'.repeat(60),
      wouldRecommend: 'oui',
      ritualTags: 'ongles-plus-lisses,plus-de-casse,halal,eclat-naturel',
    });
    expect(result.row?.ritualTags).toHaveLength(3);
    expect(result.warnings.some((w) => w.code === 'tags_truncated')).toBe(true);
  });

  it('ville inconnue mappée Autre', () => {
    const result = mapImportRow({
      body: 'a'.repeat(60),
      wouldRecommend: 'oui',
      authorCity: 'Bordeaux',
    });
    expect(result.row?.authorCity).toBe('Autre');
    expect(result.warnings.some((w) => w.code === 'city_unknown')).toBe(true);
  });

  it('ville canonique acceptée', () => {
    const result = mapImportRow({
      body: 'a'.repeat(60),
      wouldRecommend: 'oui',
      authorCity: 'Rabat',
    });
    expect(result.row?.authorCity).toBe('Rabat');
  });

  it('date initiée normalisée depuis YYYY-MM-DD', () => {
    const result = mapImportRow({
      body: 'a'.repeat(60),
      wouldRecommend: 'oui',
      initiatedSince: '2026-02-15',
    });
    expect(result.row?.initiatedSince).toBe('2026-02');
    expect(result.warnings.some((w) => w.code === 'date_normalized')).toBe(true);
  });

  it('date initiée normalisée depuis MM/YYYY', () => {
    const result = mapImportRow({
      body: 'a'.repeat(60),
      wouldRecommend: 'oui',
      initiatedSince: '2/2026',
    });
    expect(result.row?.initiatedSince).toBe('2026-02');
  });

  it('booléen isAnonymous depuis "true"', () => {
    const result = mapImportRow({
      body: 'a'.repeat(60),
      wouldRecommend: 'oui',
      isAnonymous: 'true',
    });
    expect(result.row?.isAnonymous).toBe(true);
  });

  it('defaultProductKey appliqué', () => {
    const result = mapImportRow(
      { body: 'a'.repeat(60), wouldRecommend: 'oui' },
      { defaultProductKey: 'pack-test' },
    );
    expect(result.row?.productKey).toBe('pack-test');
  });
});
