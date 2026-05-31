/**
 * CHAT-055 — Tests du builder de funnel + intent shares.
 *
 * On valide :
 *  - les ratios "fromPrev" et "fromBase" sur le chemin nominal
 *  - division par zéro = 0 (jamais NaN)
 *  - conversionRate = conversions / sessions
 *  - intent shares triés desc, ignore les buckets vides, total = 1
 */
import { describe, expect, it } from 'vitest';

import { buildFunnel, buildIntentShares } from './analytics-funnel';

describe('buildFunnel', () => {
  it('calcule les ratios fromPrev et fromBase sur un funnel nominal', () => {
    const f = buildFunnel({
      sessions: 1000,
      messagesUserSessions: 600,
      leadsOffered: 200,
      leadsSubmitted: 80,
      conversions: 20,
    });
    expect(f.steps).toHaveLength(5);
    const [s, m, lo, ls, c] = f.steps as [
      (typeof f.steps)[number],
      (typeof f.steps)[number],
      (typeof f.steps)[number],
      (typeof f.steps)[number],
      (typeof f.steps)[number],
    ];
    expect(s.value).toBe(1000);
    expect(s.fromPrev).toBeNull();
    expect(s.fromBase).toBe(1);
    expect(m.fromPrev).toBeCloseTo(0.6);
    expect(m.fromBase).toBeCloseTo(0.6);
    expect(lo.fromPrev).toBeCloseTo(200 / 600);
    expect(lo.fromBase).toBeCloseTo(0.2);
    expect(ls.fromPrev).toBeCloseTo(0.4);
    expect(ls.fromBase).toBeCloseTo(0.08);
    expect(c.fromPrev).toBeCloseTo(0.25);
    expect(c.fromBase).toBeCloseTo(0.02);
    expect(f.conversionRate).toBeCloseTo(0.02);
  });

  it('renvoie 0 pour tous les ratios quand sessions=0 (pas de NaN)', () => {
    const f = buildFunnel({
      sessions: 0,
      messagesUserSessions: 0,
      leadsOffered: 0,
      leadsSubmitted: 0,
      conversions: 0,
    });
    expect(f.conversionRate).toBe(0);
    expect(f.steps[0]!.fromBase).toBe(0);
    for (const s of f.steps.slice(1)) {
      expect(s.fromBase).toBe(0);
      expect(s.fromPrev).toBe(0);
    }
  });

  it('clamp à 0 si un palier intermédiaire est vide (évite Infinity)', () => {
    const f = buildFunnel({
      sessions: 100,
      messagesUserSessions: 0,
      leadsOffered: 5, // bug de tracking théorique
      leadsSubmitted: 2,
      conversions: 1,
    });
    // leadsOffered.fromPrev = leadsOffered / messagesUser(=0) → 0 (pas Infinity)
    expect(f.steps[2]!.fromPrev).toBe(0);
    // leadsSubmitted.fromPrev = 2 / 5 = 0.4 (calcul nominal)
    expect(f.steps[3]!.fromPrev).toBeCloseTo(0.4);
  });
});

describe('buildIntentShares', () => {
  it('trie desc par count, total des shares = 1', () => {
    const shares = buildIntentShares({
      pricing: 25,
      shipping: 17,
      'purchase-intent': 13,
      ingredient: 5,
    });
    expect(shares.map((s) => s.intent)).toEqual([
      'pricing',
      'shipping',
      'purchase-intent',
      'ingredient',
    ]);
    const total = shares.reduce((acc, s) => acc + s.share, 0);
    expect(total).toBeCloseTo(1);
    expect(shares[0]!.share).toBeCloseTo(25 / 60);
  });

  it('ignore les buckets vides (count <= 0)', () => {
    const shares = buildIntentShares({ pricing: 5, shipping: 0, foo: -1 });
    expect(shares).toHaveLength(1);
    expect(shares[0]!.intent).toBe('pricing');
    expect(shares[0]!.share).toBe(1);
  });

  it('renvoie [] quand tout est vide', () => {
    expect(buildIntentShares({})).toEqual([]);
    expect(buildIntentShares({ a: 0, b: 0 })).toEqual([]);
  });
});
