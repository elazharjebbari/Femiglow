import { describe, expect, it } from 'vitest';
import {
  bodyHash,
  duplicateFlags,
  findSimilar,
  normalizeForHash,
  trigramSimilarity,
} from './duplicate-detection';

describe('normalizeForHash', () => {
  it('retire accents', () => {
    expect(normalizeForHash("L'ongle a retrouvé sa nervure")).toBe(
      "l'ongle a retrouve sa nervure",
    );
  });

  it('collapse espaces et ponctuation', () => {
    expect(normalizeForHash('Trois  mois...  l\'ongle !!')).toBe(
      "trois mois l'ongle",
    );
  });

  it('apostrophes courbes harmonisées', () => {
    expect(normalizeForHash('L’ongle')).toBe("l'ongle");
  });
});

describe('bodyHash', () => {
  it('identique pour variantes équivalentes', () => {
    const a = bodyHash("L'ongle a retrouvé sa nervure.");
    const b = bodyHash('L’ongle a retrouvé sa nervure.');
    const c = bodyHash("L'ongle a retrouvé sa nervure !");
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it('différent pour textes distincts', () => {
    const a = bodyHash('Trois mois et ça marche');
    const b = bodyHash('Six mois et toujours rien');
    expect(a).not.toBe(b);
  });
});

describe('trigramSimilarity', () => {
  it('texte identique = 1', () => {
    expect(trigramSimilarity('hello world', 'hello world')).toBe(1);
  });

  it('texte complètement différent = faible', () => {
    expect(trigramSimilarity('abcdefg', 'zyxwvut')).toBeLessThan(0.2);
  });

  it('texte similaire = score élevé', () => {
    const score = trigramSimilarity(
      'Trois mois et l\'ongle a retrouvé sa nervure',
      'Trois mois, l\'ongle a retrouvé sa nervure',
    );
    expect(score).toBeGreaterThan(0.85);
  });
});

describe('findSimilar', () => {
  const pool = [
    { id: 'a', body: "Trois mois et l'ongle a retrouvé sa nervure." },
    { id: 'b', body: 'Mes cheveux sont plus brillants depuis un mois.' },
    { id: 'c', body: 'Trois mois et l’ongle a retrouvé sa nervure!' },
  ];

  it('détecte le doublon strict (hash identique)', () => {
    const matches = findSimilar(
      "Trois mois et l'ongle a retrouvé sa nervure",
      pool,
      0.7,
    );
    const strict = matches.find((m) => m.isStrict);
    expect(strict).toBeDefined();
    expect(['a', 'c']).toContain(strict!.id);
  });

  it('respecte le threshold', () => {
    const matches = findSimilar(
      'Mes cheveux sont plus brillants depuis un mois.',
      pool,
      0.9,
    );
    expect(matches.every((m) => m.score >= 0.9 || m.isStrict)).toBe(true);
  });

  it('trie par score décroissant', () => {
    const matches = findSimilar(
      "Trois mois et l'ongle a retrouvé sa nervure.",
      pool,
      0.3,
    );
    for (let i = 0; i < matches.length - 1; i++) {
      expect(matches[i]!.score).toBeGreaterThanOrEqual(matches[i + 1]!.score);
    }
  });
});

describe('duplicateFlags', () => {
  it('duplicate_strict si match isStrict', () => {
    const flags = duplicateFlags([{ id: 'a', score: 1, isStrict: true }]);
    expect(flags).toContain('duplicate_strict');
  });

  it('duplicate_loose si match non-strict >= 0.7', () => {
    const flags = duplicateFlags([{ id: 'a', score: 0.8, isStrict: false }]);
    expect(flags).toContain('duplicate_loose');
    expect(flags).not.toContain('duplicate_strict');
  });

  it('aucun flag si en dessous du seuil', () => {
    expect(duplicateFlags([{ id: 'a', score: 0.5, isStrict: false }])).toEqual([]);
  });
});
