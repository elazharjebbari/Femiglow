import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { highlightMatches } from './RitualsAdminSearch';

afterEach(() => cleanup());

describe('highlightMatches', () => {
  it('retourne le texte brut si pas de query', () => {
    expect(highlightMatches('Bonjour Amal', null)).toEqual(['Bonjour Amal']);
    expect(highlightMatches('Bonjour Amal', '')).toEqual(['Bonjour Amal']);
  });

  it('marque les matches en case-insensitive', () => {
    const parts = highlightMatches('Bonjour Amal, comment vas-tu Amal ?', 'amal');
    const matches = parts.filter((p) => typeof p === 'object' && p.match);
    expect(matches).toHaveLength(2);
  });

  it('échappe les caractères regex', () => {
    expect(() => highlightMatches('Resultats 100% naturels', '100%')).not.toThrow();
    const parts = highlightMatches('Resultats 100% naturels', '100%');
    const m = parts.find((p) => typeof p === 'object' && p.match) as
      | { match: true; text: string }
      | undefined;
    expect(m?.text).toBe('100%');
  });

  it('préserve la casse originale du match', () => {
    const parts = highlightMatches('Amal habite Rabat', 'rabat');
    const m = parts.find((p) => typeof p === 'object' && p.match) as
      | { match: true; text: string }
      | undefined;
    expect(m?.text).toBe('Rabat');
  });
});
