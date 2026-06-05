/**
 * PIP-UNIT-070..077 — backoff.ts : bornes exactes, jitter déterministe & borné,
 * cap 1h. Table-driven sur attempts.
 *
 * Fonctionnel : tourne tel quel contre src/lib/mail/backoff.ts (logique pure,
 * `now()` injectable -> jitter déterministe). Étend la suite existante
 * src/lib/mail/__tests__/backoff.test.ts avec les bornes exactes par attempt.
 *
 * Réf : src/lib/mail/backoff.ts ; inventaire F-083.
 */
import { describe, it, expect } from 'vitest';
import { computeBackoff, computeNextRetryAt, MAX_ATTEMPTS } from '@/lib/mail/backoff';

const BASE_MS = 60_000;
const MAX_MS = 60 * 60_000;

describe('computeBackoff — bornes exactes (PIP-UNIT-071/075)', () => {
  // base = min(BASE * 2^(attempt-1), MAX_MS) ; jitter dans [0, 0.3*base].
  const expectedBase = (attempt: number) => Math.min(BASE_MS * 2 ** (attempt - 1), MAX_MS);

  it.each([1, 2, 3, 4, 5, 6, 10, 20])(
    'PIP-UNIT-071 : attempt=%i → delay ∈ [base, base*1.3]',
    (attempt) => {
      const base = expectedBase(attempt);
      // now() balayé sur tout le domaine du jitter (%1000).
      for (const t of [0, 1, 250, 499, 500, 750, 999]) {
        const d = computeBackoff(attempt, () => t);
        expect(d).toBeGreaterThanOrEqual(base);
        expect(d).toBeLessThanOrEqual(Math.round(base * 1.3) + 1);
      }
    },
  );

  it('PIP-UNIT-075 : attempt=1 base minimale 60s', () => {
    expect(computeBackoff(1, () => 0)).toBe(BASE_MS);
  });

  it('PIP-UNIT-070 : attempt<=0 → 0', () => {
    expect(computeBackoff(0)).toBe(0);
    expect(computeBackoff(-3)).toBe(0);
  });
});

describe('computeBackoff — cap 1h (PIP-UNIT-072)', () => {
  it('plafonne la base à 1h dès attempt assez grand', () => {
    // 2^(attempt-1)*60000 >= 3_600_000 dès attempt>=7.
    for (const attempt of [7, 8, 12, 20, 50]) {
      const d = computeBackoff(attempt, () => 0);
      expect(d).toBe(MAX_MS); // jitter nul quand now()=0
    }
  });

  it('même avec jitter max reste <= cap*1.3', () => {
    const d = computeBackoff(20, () => 999);
    expect(d).toBeLessThanOrEqual(Math.round(MAX_MS * 1.3) + 1);
  });
});

describe('computeBackoff — jitter (PIP-UNIT-073/074)', () => {
  it('PIP-UNIT-073 : déterministe pour un now() fixé', () => {
    expect(computeBackoff(3, () => 314)).toBe(computeBackoff(3, () => 314));
  });

  it('PIP-UNIT-074 : jitter borné à 30% de la base', () => {
    const base = BASE_MS * 2 ** (3 - 1); // attempt 3
    const max = computeBackoff(3, () => 999);
    const min = computeBackoff(3, () => 0);
    expect(min).toBe(base); // jitter 0
    expect(max - base).toBeLessThanOrEqual(Math.ceil(0.3 * base));
  });

  it('croissance monotone de la base sur attempts successifs (jitter figé)', () => {
    const f = () => 0;
    const ds = [1, 2, 3, 4].map((a) => computeBackoff(a, f));
    for (let i = 1; i < ds.length; i++) expect(ds[i]!).toBeGreaterThan(ds[i - 1]!);
  });
});

describe('computeNextRetryAt & constantes (PIP-UNIT-076/077)', () => {
  it('PIP-UNIT-076 : retourne une Date future pour attempt>0', () => {
    const from = new Date('2026-06-15T12:00:00Z');
    expect(computeNextRetryAt(2, from).getTime()).toBeGreaterThan(from.getTime());
  });

  it('attempt=0 → même instant', () => {
    const from = new Date('2026-06-15T12:00:00Z');
    expect(computeNextRetryAt(0, from).getTime()).toBe(from.getTime());
  });

  it('PIP-UNIT-077 : MAX_ATTEMPTS == 5', () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });
});
