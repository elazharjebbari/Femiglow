import { describe, expect, it } from 'vitest';

import { sortByConcentrationDesc } from './sort';

describe('sortByConcentrationDesc', () => {
  it('trie par concentrationPct décroissante', () => {
    const r = sortByConcentrationDesc([
      { name: 'A', concentrationPct: 5 },
      { name: 'B', concentrationPct: 60 },
      { name: 'C', concentrationPct: 12 },
    ]);
    expect(r.map((i) => i.name)).toEqual(['B', 'C', 'A']);
  });

  it('place les ingrédients sans concentrationPct en queue', () => {
    const r = sortByConcentrationDesc([
      { name: 'A', concentrationPct: 5 },
      { name: 'B' },
      { name: 'C', concentrationPct: 60 },
    ]);
    expect(r.map((i) => i.name)).toEqual(['C', 'A', 'B']);
  });

  it('préserve l\'ordre source pour les ingrédients sans %', () => {
    const r = sortByConcentrationDesc([
      { name: 'X' },
      { name: 'Y' },
      { name: 'Z' },
    ]);
    expect(r.map((i) => i.name)).toEqual(['X', 'Y', 'Z']);
  });

  it('retourne une nouvelle référence (immutabilité)', () => {
    const input = [{ name: 'A', concentrationPct: 1 }];
    const r = sortByConcentrationDesc(input);
    expect(r).not.toBe(input);
  });

  it('gère un tableau vide', () => {
    expect(sortByConcentrationDesc([])).toEqual([]);
  });

  it('stable sur valeurs égales (préserve ordre source)', () => {
    const r = sortByConcentrationDesc([
      { name: 'A', concentrationPct: 10 },
      { name: 'B', concentrationPct: 10 },
      { name: 'C', concentrationPct: 10 },
    ]);
    expect(r.map((i) => i.name)).toEqual(['A', 'B', 'C']);
  });
});
