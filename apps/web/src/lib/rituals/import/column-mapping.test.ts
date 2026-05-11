import { describe, expect, it } from 'vitest';
import {
  applyColumnMapping,
  autoDetectMapping,
  hasRequiredFields,
  CANONICAL_FIELDS,
} from './column-mapping';

describe('autoDetectMapping', () => {
  it('détecte les en-têtes canoniques exacts', () => {
    const mapping = autoDetectMapping(['body', 'wouldRecommend']);
    expect(mapping.body).toBe('body');
    expect(mapping.wouldRecommend).toBe('wouldRecommend');
  });

  it('détecte les synonymes français', () => {
    const mapping = autoDetectMapping(['Témoignage', 'Recommandation', 'Prénom']);
    expect(mapping['Témoignage']).toBe('body');
    expect(mapping['Recommandation']).toBe('wouldRecommend');
    expect(mapping['Prénom']).toBe('authorFirstName');
  });

  it('insensible à la casse et accents', () => {
    const mapping = autoDetectMapping(['TÉMOIGNAGE', 'temoignage']);
    expect(mapping['TÉMOIGNAGE']).toBe('body');
    expect(mapping['temoignage']).toBe('body');
  });

  it('null si en-tête inconnu', () => {
    const mapping = autoDetectMapping(['Notes internes']);
    expect(mapping['Notes internes']).toBeNull();
  });

  it('détecte all canonical', () => {
    const mapping = autoDetectMapping([...CANONICAL_FIELDS]);
    for (const f of CANONICAL_FIELDS) {
      expect(mapping[f]).toBe(f);
    }
  });
});

describe('hasRequiredFields', () => {
  it('true si body + wouldRecommend mappés', () => {
    expect(
      hasRequiredFields({
        'col1': 'body',
        'col2': 'wouldRecommend',
      }),
    ).toBe(true);
  });

  it('false si body manquant', () => {
    expect(
      hasRequiredFields({
        'col1': 'wouldRecommend',
        'col2': 'authorFirstName',
      }),
    ).toBe(false);
  });

  it('false si wouldRecommend manquant', () => {
    expect(
      hasRequiredFields({
        'col1': 'body',
      }),
    ).toBe(false);
  });
});

describe('applyColumnMapping', () => {
  it('applique le mapping et ignore les non mappés', () => {
    const result = applyColumnMapping(
      { 'Témoignage': 'a', 'Prénom': 'Amal', 'Note interne': 'ignore' },
      { 'Témoignage': 'body', 'Prénom': 'authorFirstName', 'Note interne': null },
    );
    expect(result).toEqual({ body: 'a', authorFirstName: 'Amal' });
  });
});
