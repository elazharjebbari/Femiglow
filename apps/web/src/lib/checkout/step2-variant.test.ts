import { describe, expect, it } from 'vitest';

import {
  normalizeStep2SharePct,
  parseStep2Override,
  resolveStep2Variant,
  step2NeedsVisitor,
} from './step2-variant';

describe('variante de l’étape 2', () => {
  it('part à 0 : tout le monde reste sur la version actuelle', () => {
    for (const id of ['a', 'b', 'c', 'visiteur-long-123']) {
      expect(resolveStep2Variant({ sharePct: 0, visitorId: id })).toBe('control');
    }
  });

  it('part à 100 : tout le monde en V2', () => {
    expect(resolveStep2Variant({ sharePct: 100, visitorId: null })).toBe('v2');
  });

  it('?step2= prime sur le réglage, dans les deux sens', () => {
    expect(resolveStep2Variant({ sharePct: 0, override: 'v2' })).toBe('v2');
    expect(resolveStep2Variant({ sharePct: 100, override: 'control' })).toBe('control');
    expect(resolveStep2Variant({ sharePct: 0, override: 'autre' })).toBe('control');
  });

  it('sans identifiant : témoin, jamais de tirage instable', () => {
    expect(resolveStep2Variant({ sharePct: 50, visitorId: null })).toBe('control');
  });

  it('une même visiteuse garde sa variante', () => {
    const first = resolveStep2Variant({ sharePct: 50, visitorId: 'v_abc' });
    for (let i = 0; i < 20; i += 1) {
      expect(resolveStep2Variant({ sharePct: 50, visitorId: 'v_abc' })).toBe(first);
    }
  });

  it('à 50 %, répartition proche de 50/50 sur 10 000 visiteuses', () => {
    let v2 = 0;
    for (let i = 0; i < 10_000; i += 1) {
      if (resolveStep2Variant({ sharePct: 50, visitorId: `v_${i}` }) === 'v2') v2 += 1;
    }
    expect(v2).toBeGreaterThan(4_700);
    expect(v2).toBeLessThan(5_300);
  });

  it('tirage indépendant du test panneau ou défilement', () => {
    // Même visiteur, clés différentes : pas de calque systématique.
    let identical = 0;
    for (let i = 0; i < 2_000; i += 1) {
      const a = resolveStep2Variant({ sharePct: 50, visitorId: `v_${i}` }) === 'v2';
      const b = resolveStep2Variant({ sharePct: 50, visitorId: `w_${i}` }) === 'v2';
      if (a === b) identical += 1;
    }
    expect(identical).toBeGreaterThan(800);
    expect(identical).toBeLessThan(1_200);
  });

  it('fg_aid lu seulement s’il y a un vrai tirage', () => {
    expect(step2NeedsVisitor(0, null)).toBe(false);
    expect(step2NeedsVisitor(100, null)).toBe(false);
    expect(step2NeedsVisitor(50, 'v2')).toBe(false);
    expect(step2NeedsVisitor(50, null)).toBe(true);
  });

  it('valeur illisible : le test se coupe', () => {
    expect(normalizeStep2SharePct('abc')).toBe(0);
    expect(normalizeStep2SharePct(null)).toBe(0);
    expect(normalizeStep2SharePct('30')).toBe(30);
    expect(normalizeStep2SharePct(140)).toBe(100);
    expect(parseStep2Override(' V2 ')).toBe('v2');
    expect(parseStep2Override(3)).toBeNull();
  });
});
