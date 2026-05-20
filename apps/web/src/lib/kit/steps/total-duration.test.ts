/**
 * Tests `computeTotalDuration` — helper pur.
 */
import { describe, it, expect } from 'vitest';

import { computeTotalDuration } from './total-duration';

describe('computeTotalDuration', () => {
  it('retourne null sur tableau vide', () => {
    expect(computeTotalDuration([])).toBeNull();
  });

  it('retourne null si aucune durée parseable', () => {
    expect(computeTotalDuration([{ duration: undefined }, {}])).toBeNull();
  });

  it('additionne 30 s + 1 min + 2 min + 1 min = 5 minutes', () => {
    expect(
      computeTotalDuration([
        { duration: '30 s' },
        { duration: '1 min' },
        { duration: '2 min' },
        { duration: '1 min' },
      ]),
    ).toBe('5 minutes');
  });

  it('accepte NBSP comme séparateur (« 30 s »)', () => {
    expect(
      computeTotalDuration([
        { duration: '30 s' },
        { duration: '1 min' },
      ]),
    ).toBe('2 minutes');
  });

  it('ignore les durées inparseables sans crash', () => {
    expect(
      computeTotalDuration([
        { duration: 'abc' },
        { duration: '1 min' },
        { duration: '30 s' },
      ]),
    ).toBe('2 minutes');
  });

  it('si < 60 s, retourne « N s »', () => {
    expect(computeTotalDuration([{ duration: '30 s' }])).toBe('30 s');
  });

  it('arrondit à la minute la plus proche au-delà de 60 s', () => {
    // 30 + 30 + 30 + 30 = 120 s = 2 minutes
    expect(
      computeTotalDuration([
        { duration: '30 s' },
        { duration: '30 s' },
        { duration: '30 s' },
        { duration: '30 s' },
      ]),
    ).toBe('2 minutes');
  });

  it('rejette valeurs négatives ou non finies', () => {
    expect(computeTotalDuration([{ duration: '-1 min' }])).toBeNull();
  });
});
