import { describe, expect, it } from 'vitest';

import { resolveStep2Variant } from './step2-variant';
import {
  parseStep2AckOverride,
  resolveStep2Ack,
  step2AckNeedsVisitor,
} from './step2-ack';

describe('accusé de l’étape 2 — qui le voit', () => {
  it('part à 100 : toutes ; part à 0 : aucune', () => {
    expect(resolveStep2Ack({ sharePct: 100, visitorId: null })).toBe(true);
    for (const id of ['a', 'b', 'visiteuse-123']) {
      expect(resolveStep2Ack({ sharePct: 0, visitorId: id })).toBe(false);
    }
  });

  it('?ack= prime sur le réglage, dans les deux sens', () => {
    expect(resolveStep2Ack({ sharePct: 0, override: 'on' })).toBe(true);
    expect(resolveStep2Ack({ sharePct: 100, override: 'off' })).toBe(false);
    expect(resolveStep2Ack({ sharePct: 100, override: ' OFF ' })).toBe(false);
    expect(resolveStep2Ack({ sharePct: 0, override: 'autre' })).toBe(false);
    expect(parseStep2AckOverride(null)).toBeNull();
  });

  it('sans identifiant : pas d’accusé, jamais de tirage instable', () => {
    expect(resolveStep2Ack({ sharePct: 50, visitorId: null })).toBe(false);
  });

  it('une même visiteuse garde son bras', () => {
    const first = resolveStep2Ack({ sharePct: 50, visitorId: 'v_abc' });
    for (let i = 0; i < 20; i += 1) {
      expect(resolveStep2Ack({ sharePct: 50, visitorId: 'v_abc' })).toBe(first);
    }
  });

  it('à 50 %, répartition proche de 50/50 sur 10 000 visiteuses', () => {
    let shown = 0;
    for (let i = 0; i < 10_000; i += 1) {
      if (resolveStep2Ack({ sharePct: 50, visitorId: `v_${i}` })) shown += 1;
    }
    expect(shown).toBeGreaterThan(4_700);
    expect(shown).toBeLessThan(5_300);
  });

  it('tirage indépendant de celui de l’étape 2 progressive', () => {
    let identical = 0;
    for (let i = 0; i < 2_000; i += 1) {
      const ack = resolveStep2Ack({ sharePct: 50, visitorId: `v_${i}` });
      const v2 = resolveStep2Variant({ sharePct: 50, visitorId: `v_${i}` }) === 'v2';
      if (ack === v2) identical += 1;
    }
    expect(identical).toBeGreaterThan(800);
    expect(identical).toBeLessThan(1_200);
  });

  it('fg_aid lu seulement s’il y a un vrai tirage', () => {
    expect(step2AckNeedsVisitor(0, null)).toBe(false);
    expect(step2AckNeedsVisitor(100, null)).toBe(false);
    expect(step2AckNeedsVisitor(50, 'off')).toBe(false);
    expect(step2AckNeedsVisitor(50, null)).toBe(true);
  });
});
