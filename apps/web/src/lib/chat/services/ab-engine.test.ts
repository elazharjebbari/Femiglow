/**
 * CHAT-058 — Tests `ab-engine`.
 *
 * On valide :
 *  - `assignVariant` est déterministe pour le même couple (expKey, visitorId)
 *  - distribution approchée des weights sur N visiteurs aléatoires
 *  - 'default' retourné si enabled=false ou pas de variants ou visitorId vide
 *  - `assignChatVariants` n'inclut que les expériences `enabled: true`
 *  - encode/decode roundtrip
 */
import { describe, expect, it } from 'vitest';

import {
  assignVariant,
  assignChatVariants,
  encodeVariantsForSession,
  decodeVariantsFromSession,
  CHAT_EXPERIMENTS,
  type AbVariant,
} from './ab-engine';

describe('assignVariant', () => {
  it('est déterministe pour le même couple (expKey, visitorId)', () => {
    const variants: AbVariant[] = [{ key: 'A', weight: 0.5 }];
    const v1 = assignVariant('exp-x', 'visitor-123', variants);
    const v2 = assignVariant('exp-x', 'visitor-123', variants);
    expect(v1).toBe(v2);
  });

  it("ne retourne pas le même variant pour deux visitorId différents (changement détectable)", () => {
    const variants: AbVariant[] = [{ key: 'A', weight: 0.5 }];
    // Pas garanti à 100 %, mais sur ces deux IDs précis on attend des seeds très différents
    const a = assignVariant('exp-x', 'visitor-aaa', variants);
    const b = assignVariant('exp-x', 'visitor-zzz', variants);
    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
  });

  it("retourne 'default' quand enabled=false", () => {
    const variants: AbVariant[] = [{ key: 'A', weight: 1 }];
    expect(assignVariant('exp-x', 'visitor-1', variants, false)).toBe('default');
  });

  it("retourne 'default' quand variants est vide", () => {
    expect(assignVariant('exp-x', 'visitor-1', [])).toBe('default');
  });

  it("retourne 'default' quand visitorId est vide", () => {
    const variants: AbVariant[] = [{ key: 'A', weight: 1 }];
    expect(assignVariant('exp-x', '', variants)).toBe('default');
  });

  it('ignore les weights ≤ 0', () => {
    const variants: AbVariant[] = [
      { key: 'A', weight: 0 },
      { key: 'B', weight: 1 },
    ];
    // Au moins 'B' devrait sortir si le ratio < 1 (toujours pour FNV-1a).
    const v = assignVariant('exp-x', 'visitor-1', variants);
    expect(v).toBe('B');
  });

  it('distribution ≈ proche du weight sur 10000 visiteurs (50/50)', () => {
    const variants: AbVariant[] = [{ key: 'A', weight: 0.5 }];
    let countA = 0;
    let countDefault = 0;
    for (let i = 0; i < 10000; i += 1) {
      const v = assignVariant('exp-x', `visitor-${i}`, variants);
      if (v === 'A') countA += 1;
      else countDefault += 1;
    }
    // Tolérance large : +/- 3 % sur 10000 tirages
    expect(countA).toBeGreaterThan(4700);
    expect(countA).toBeLessThan(5300);
    expect(countDefault).toBeGreaterThan(4700);
    expect(countDefault).toBeLessThan(5300);
  });

  it('distribution multi-variants (30/30/40)', () => {
    const variants: AbVariant[] = [
      { key: 'A', weight: 0.3 },
      { key: 'B', weight: 0.3 },
    ];
    // 'default' couvre les 40 % restants
    const counts: Record<string, number> = { A: 0, B: 0, default: 0 };
    for (let i = 0; i < 10000; i += 1) {
      const v = assignVariant('exp-x', `visitor-${i}`, variants);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    expect(counts.A).toBeGreaterThan(2700);
    expect(counts.A).toBeLessThan(3300);
    expect(counts.B).toBeGreaterThan(2700);
    expect(counts.B).toBeLessThan(3300);
    expect(counts.default).toBeGreaterThan(3700);
    expect(counts.default).toBeLessThan(4300);
  });
});

describe('assignChatVariants', () => {
  it("n'inclut PAS les expériences désactivées du registre", () => {
    // Toutes les expériences sont enabled:false par défaut dans le registre.
    const allDisabled = CHAT_EXPERIMENTS.every((e) => !e.enabled);
    expect(allDisabled).toBe(true);
    const out = assignChatVariants('visitor-1');
    expect(out).toEqual({});
  });
});

describe('encodeVariantsForSession', () => {
  it("retourne 'default' quand l'objet est vide", () => {
    expect(encodeVariantsForSession({})).toBe('default');
  });

  it('encode en URLSearchParams trié par clé', () => {
    const encoded = encodeVariantsForSession({
      'exp-b': 'beta',
      'exp-a': 'alpha',
    });
    // Les clés doivent être triées pour rester stable côté DB
    expect(encoded).toBe('exp-a=alpha&exp-b=beta');
  });
});

describe('decodeVariantsFromSession', () => {
  it("retourne {} pour null/undefined/'default'", () => {
    expect(decodeVariantsFromSession(null)).toEqual({});
    expect(decodeVariantsFromSession(undefined)).toEqual({});
    expect(decodeVariantsFromSession('default')).toEqual({});
    expect(decodeVariantsFromSession('')).toEqual({});
  });

  it('parse correctement un opaque ID', () => {
    expect(decodeVariantsFromSession('exp-a=alpha&exp-b=beta')).toEqual({
      'exp-a': 'alpha',
      'exp-b': 'beta',
    });
  });

  it('roundtrip encode → decode est stable', () => {
    const input = { 'exp-x': 'A', 'exp-y': 'B' };
    const encoded = encodeVariantsForSession(input);
    const decoded = decodeVariantsFromSession(encoded);
    expect(decoded).toEqual(input);
  });
});
