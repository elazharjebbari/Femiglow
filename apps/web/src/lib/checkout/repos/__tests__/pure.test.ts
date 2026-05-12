/**
 * Tests unitaires — fonctions pures des repos CHA-230.
 *
 * Ne touchent PAS la DB. Couvrent :
 *   - `hashRequestPayload` : canonicalisation + déterminisme
 *   - `computeStockStatus` / `computeEffectiveDisplay`
 *   - `resolveDeterministicVariant`
 */
import { describe, expect, it } from 'vitest';

import { hashRequestPayload } from '../idempotency-repo';
import {
  computeEffectiveDisplay,
  computeStockStatus,
} from '../stock-repo';
import { resolveDeterministicVariant } from '../variant-assignment-repo';

describe('hashRequestPayload', () => {
  it('produit un hash hex 64 chars', () => {
    const hash = hashRequestPayload({ foo: 'bar' });
    expect(hash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('est insensible à l\'ordre des clés (canonicalisation)', () => {
    const a = hashRequestPayload({ a: 1, b: 2 });
    const b = hashRequestPayload({ b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it('distingue des payloads sémantiquement différents', () => {
    const a = hashRequestPayload({ a: 1 });
    const b = hashRequestPayload({ a: 2 });
    expect(a).not.toBe(b);
  });

  it('gère les arrays, null, undefined', () => {
    const hash1 = hashRequestPayload({ items: [1, 2, 3], x: null });
    const hash2 = hashRequestPayload({ items: [1, 2, 3], x: undefined });
    // null et undefined sont canonicalisés en 'null'
    expect(hash1).toBe(hash2);
  });

  it('produit des hashs distincts pour des arrays d\'ordre différent', () => {
    const a = hashRequestPayload({ items: [1, 2, 3] });
    const b = hashRequestPayload({ items: [3, 2, 1] });
    expect(a).not.toBe(b);
  });
});

describe('computeStockStatus / computeEffectiveDisplay', () => {
  it('out_of_stock quand available - reserved <= 0', () => {
    expect(computeStockStatus({ available: 0, reserved: 0, thresholdLow: 5 })).toBe(
      'out_of_stock',
    );
    expect(computeStockStatus({ available: 3, reserved: 3, thresholdLow: 5 })).toBe(
      'out_of_stock',
    );
    expect(computeStockStatus({ available: 2, reserved: 5, thresholdLow: 5 })).toBe(
      'out_of_stock',
    );
  });

  it('low_stock quand 0 < effective <= thresholdLow', () => {
    expect(computeStockStatus({ available: 5, reserved: 0, thresholdLow: 5 })).toBe(
      'low_stock',
    );
    expect(computeStockStatus({ available: 3, reserved: 0, thresholdLow: 5 })).toBe(
      'low_stock',
    );
  });

  it('in_stock quand effective > thresholdLow', () => {
    expect(computeStockStatus({ available: 100, reserved: 0, thresholdLow: 5 })).toBe(
      'in_stock',
    );
    expect(computeStockStatus({ available: 6, reserved: 0, thresholdLow: 5 })).toBe(
      'in_stock',
    );
  });

  it('computeEffectiveDisplay masque la valeur en in_stock (sentinel -1)', () => {
    expect(computeEffectiveDisplay({ available: 100, reserved: 0, thresholdLow: 5 })).toBe(
      -1,
    );
    expect(computeEffectiveDisplay({ available: 3, reserved: 0, thresholdLow: 5 })).toBe(3);
    expect(computeEffectiveDisplay({ available: 0, reserved: 0, thresholdLow: 5 })).toBe(0);
  });
});

describe('resolveDeterministicVariant', () => {
  it('est déterministe pour un même visitorId', () => {
    const v1 = resolveDeterministicVariant('visitor_abc');
    const v2 = resolveDeterministicVariant('visitor_abc');
    expect(v1).toBe(v2);
  });

  it('renvoie uniquement A ou B (jamais control)', () => {
    for (let i = 0; i < 100; i += 1) {
      const v = resolveDeterministicVariant(`visitor_${i}`);
      expect(['A', 'B']).toContain(v);
    }
  });

  it('répartit approximativement 50/50 sur 1000 visiteurs', () => {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 1000; i += 1) {
      const v = resolveDeterministicVariant(`visitor_${i}_${Math.random()}`);
      if (v === 'A') a += 1;
      else b += 1;
    }
    // Tolérance large : ±15% sur 1000 échantillons → entre 350 et 650 par bucket
    expect(a).toBeGreaterThan(350);
    expect(a).toBeLessThan(650);
    expect(b).toBeGreaterThan(350);
    expect(b).toBeLessThan(650);
  });

  it('honore les poids (90/10)', () => {
    let a = 0;
    let b = 0;
    for (let i = 0; i < 1000; i += 1) {
      const v = resolveDeterministicVariant(`visitor_w_${i}_${Math.random()}`, {
        A: 90,
        B: 10,
      });
      if (v === 'A') a += 1;
      else b += 1;
    }
    expect(a).toBeGreaterThan(800);
    expect(b).toBeLessThan(200);
  });
});
