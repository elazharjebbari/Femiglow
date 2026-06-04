/**
 * CHANTIER H — Module 08 : backoff exhaustif (unit dense).
 *
 * `computeBackoff(attempt, now)` = round( base + jitter ) où
 *   base   = min(60_000 · 2^(attempt-1), 3_600_000)  (1 min → cap 1 h)
 *   jitter = (now()%1000)/1000 · 0.3 · base           (déterministe, ∈ [0, 0.3·base))
 *
 * Oracles : bornes exactes par attempt, jitter borné À 30 % et DANS l'intervalle,
 * monotonie stricte avant cap, plateau au cap, déterminisme par `now()` fixé,
 * base minimale 60 s, `computeNextRetryAt` futur, `MAX_ATTEMPTS == 5`.
 *
 * IDs matrice : PIP-UNIT-070..077.
 */
import { describe, expect, it } from 'vitest';
import { computeBackoff, computeNextRetryAt, MAX_ATTEMPTS } from '../../backoff';

const BASE_MS = 60_000;
const MAX_MS = 60 * 60_000; // 1 h
const JITTER_FRAC = 0.3;

/** base théorique (sans jitter) pour un attempt donné. */
function expectedBase(attempt: number): number {
  return Math.min(BASE_MS * 2 ** (attempt - 1), MAX_MS);
}

describe('computeBackoff — bornes & jitter (Module 08)', () => {
  // PIP-UNIT-070 — attempt <= 0 → 0 (rien à attendre).
  it('PIP-UNIT-070 — retourne 0 pour attempt <= 0', () => {
    expect(computeBackoff(0)).toBe(0);
    expect(computeBackoff(-1)).toBe(0);
    expect(computeBackoff(-100)).toBe(0);
  });

  // PIP-UNIT-075 — base minimale 60 s au 1er essai (jitter neutralisé).
  it('PIP-UNIT-075 — base minimale 60 s à attempt 1 (now()=0 → jitter nul)', () => {
    expect(computeBackoff(1, () => 0)).toBe(BASE_MS);
  });

  // PIP-UNIT-071 — croissance STRICTEMENT monotone sur 1..4 (avant cap), jitter
  // neutralisé pour comparer les bases pures.
  it('PIP-UNIT-071 — croissance stricte attempts 1..5 (jitter neutralisé)', () => {
    const now = () => 0;
    const delays = [1, 2, 3, 4, 5].map((a) => computeBackoff(a, now));
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]!).toBeGreaterThan(delays[i - 1]!);
    }
    // Valeurs exactes attendues (doublement) : 60s,120s,240s,480s,960s.
    expect(delays).toEqual([60_000, 120_000, 240_000, 480_000, 960_000]);
  });

  // Bornes EXACTES attempts→délais (jitter nul) : oracle dur sur la table.
  it('attempt → délai exact (jitter nul) suit le doublement puis le cap', () => {
    const now = () => 0;
    expect(computeBackoff(1, now)).toBe(60_000);
    expect(computeBackoff(2, now)).toBe(120_000);
    expect(computeBackoff(3, now)).toBe(240_000);
    expect(computeBackoff(4, now)).toBe(480_000);
    expect(computeBackoff(5, now)).toBe(960_000);
    expect(computeBackoff(6, now)).toBe(1_920_000);
    expect(computeBackoff(7, now)).toBe(MAX_MS); // 3_840_000 plafonné à 3_600_000
  });

  // PIP-UNIT-072 — cap à 1 h : même pour un attempt énorme, la base ne dépasse
  // pas MAX_MS ; le total reste ≤ MAX_MS·1.3 (cap + jitter max).
  it('PIP-UNIT-072 — cap à 1h (base plafonnée) même pour attempt géant', () => {
    const nowMax = () => 999; // jitter quasi max
    const d = computeBackoff(50, nowMax);
    // base plafonnée à MAX_MS ; jitter ≤ 0.3·MAX_MS.
    expect(d).toBeLessThanOrEqual(MAX_MS + Math.ceil(JITTER_FRAC * MAX_MS));
    expect(d).toBeGreaterThanOrEqual(MAX_MS); // au moins le cap
  });

  // PIP-UNIT-073 — déterminisme : deux appels avec le MÊME now() sont égaux.
  it('PIP-UNIT-073 — jitter déterministe pour now() fixé', () => {
    expect(computeBackoff(3, () => 500)).toBe(computeBackoff(3, () => 500));
    expect(computeBackoff(7, () => 123)).toBe(computeBackoff(7, () => 123));
  });

  // PIP-UNIT-074 — jitter BORNÉ à 30 % ET DANS l'intervalle [0, 0.3·base) :
  // on balaie plusieurs valeurs de now() et plusieurs attempts.
  it('PIP-UNIT-074 — jitter ∈ [0, 0.3·base] pour tout now()', () => {
    for (const attempt of [1, 2, 4, 8]) {
      const base = expectedBase(attempt);
      for (const ms of [0, 1, 250, 500, 750, 999]) {
        const d = computeBackoff(attempt, () => ms);
        const delta = d - base;
        // delta ≥ 0 (jamais sous la base) et ≤ 0.3·base (+1 pour l'arrondi).
        expect(delta).toBeGreaterThanOrEqual(0);
        expect(delta).toBeLessThanOrEqual(JITTER_FRAC * base + 1);
        // Valeur exacte attendue (modulo arrondi) : base + (ms/1000)·0.3·base.
        const expected = Math.round(base + (ms / 1000) * JITTER_FRAC * base);
        expect(d).toBe(expected);
      }
    }
  });

  // Le jitter ne dépend QUE de now()%1000 (cycle 1000ms identique).
  it('jitter ne dépend que de now() modulo 1000', () => {
    expect(computeBackoff(3, () => 1500)).toBe(computeBackoff(3, () => 500));
    expect(computeBackoff(3, () => 1_000_000 + 250)).toBe(computeBackoff(3, () => 250));
  });
});

describe('computeNextRetryAt — date future (Module 08)', () => {
  // PIP-UNIT-076 — pour attempt > 0, la date est STRICTEMENT future.
  it('PIP-UNIT-076 — retourne une date future pour attempt > 0', () => {
    const from = new Date('2026-06-04T12:00:00Z');
    const next = computeNextRetryAt(1, from);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
    // Écart = computeBackoff(1) (jitter dérivé de Date.now() interne, donc on
    // borne plutôt qu'on n'égale).
    const delta = next.getTime() - from.getTime();
    expect(delta).toBeGreaterThanOrEqual(BASE_MS);
    expect(delta).toBeLessThanOrEqual(BASE_MS + JITTER_FRAC * BASE_MS + 1);
  });

  it('retourne la même heure pour attempt = 0 (pas d attente)', () => {
    const from = new Date('2026-06-04T12:00:00Z');
    expect(computeNextRetryAt(0, from).getTime()).toBe(from.getTime());
  });
});

describe('constantes (Module 08)', () => {
  // PIP-UNIT-077 — MAX_ATTEMPTS == 5 (budget de retry stable).
  it('PIP-UNIT-077 — MAX_ATTEMPTS vaut 5', () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });
});
