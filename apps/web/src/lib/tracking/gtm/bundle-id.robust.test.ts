import { describe, expect, it } from 'vitest';
import { computeBundleId, isValidBundleId } from './bundle-id';

/**
 * Tests robustes (property-based / fuzz) pour `computeBundleId`.
 */

function randomEvents(seed: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `event_${seed}_${i}`,
    resolvedNames: {
      meta: `Meta_${seed}_${i}`,
      google_ga4: `ga4_${seed}_${i}`,
    },
  }));
}

describe('computeBundleId — propriétés', () => {
  it('100 inputs aléatoires distincts produisent 100 ids distincts', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(
        computeBundleId({
          mappingVersion: `v${i}`,
          configVersion: 'v4',
          containerId: 'GTM-ABCD',
          events: randomEvents(i, 5),
          generatedAt: `2026-05-13T19:30:0${i % 10}.000Z`,
        }),
      );
    }
    expect(ids.size).toBe(100);
  });

  it('1000 inputs identiques produisent 1 seul id (déterminisme stable)', () => {
    const input = {
      mappingVersion: 'v17',
      configVersion: 'v4',
      containerId: 'GTM-ABCD',
      events: randomEvents(42, 10),
      generatedAt: '2026-05-13T19:30:00.000Z',
    };
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) ids.add(computeBundleId(input));
    expect(ids.size).toBe(1);
  });

  it('insensible à l\'ordre des events (toujours)', () => {
    for (let trial = 0; trial < 20; trial++) {
      const events = randomEvents(trial, 10);
      const shuffled = [...events].sort(() => Math.random() - 0.5);
      const base = {
        mappingVersion: 'v17',
        configVersion: 'v4',
        containerId: 'GTM-ABCD',
        generatedAt: '2026-05-13T19:30:00.000Z',
      };
      expect(computeBundleId({ ...base, events })).toBe(computeBundleId({ ...base, events: shuffled }));
    }
  });

  it('insensible à l\'ordre des clés dans resolvedNames', () => {
    const eventsA = [
      { name: 'purchase', resolvedNames: { meta: 'Purchase', google_ga4: 'purchase', tiktok: 'CompletePayment' } },
    ];
    const eventsB = [
      { name: 'purchase', resolvedNames: { tiktok: 'CompletePayment', google_ga4: 'purchase', meta: 'Purchase' } },
    ];
    const base = {
      mappingVersion: 'v17',
      configVersion: 'v4',
      containerId: 'GTM-ABCD',
      generatedAt: '2026-05-13T19:30:00.000Z',
    };
    expect(computeBundleId({ ...base, events: eventsA })).toBe(computeBundleId({ ...base, events: eventsB }));
  });

  it('events vides → id valide', () => {
    const id = computeBundleId({
      mappingVersion: 'v17',
      configVersion: 'v4',
      containerId: 'GTM-ABCD',
      events: [],
      generatedAt: '2026-05-13T19:30:00.000Z',
    });
    expect(isValidBundleId(id)).toBe(true);
  });

  it('events avec resolvedNames vide → id valide', () => {
    const id = computeBundleId({
      mappingVersion: 'v17',
      configVersion: 'v4',
      containerId: 'GTM-ABCD',
      events: [{ name: 'purchase', resolvedNames: {} }],
      generatedAt: '2026-05-13T19:30:00.000Z',
    });
    expect(isValidBundleId(id)).toBe(true);
  });

  it('caractères unicode dans event names → id valide', () => {
    const id = computeBundleId({
      mappingVersion: 'v17',
      configVersion: 'v4',
      containerId: 'GTM-ABCD',
      events: [{ name: 'événement_café_🍰', resolvedNames: { meta: 'Café' } }],
      generatedAt: '2026-05-13T19:30:00.000Z',
    });
    expect(isValidBundleId(id)).toBe(true);
  });

  it('event names longues (256 chars) → id stable', () => {
    const long = 'x'.repeat(256);
    const id1 = computeBundleId({
      mappingVersion: 'v17',
      configVersion: 'v4',
      containerId: 'GTM-ABCD',
      events: [{ name: long, resolvedNames: { meta: long } }],
      generatedAt: '2026-05-13T19:30:00.000Z',
    });
    const id2 = computeBundleId({
      mappingVersion: 'v17',
      configVersion: 'v4',
      containerId: 'GTM-ABCD',
      events: [{ name: long, resolvedNames: { meta: long } }],
      generatedAt: '2026-05-13T19:30:00.000Z',
    });
    expect(id1).toBe(id2);
    expect(isValidBundleId(id1)).toBe(true);
  });
});

describe('computeBundleId — distribution', () => {
  it('1000 ids ne montrent pas de pattern hex évident', () => {
    const ids: string[] = [];
    for (let i = 0; i < 1000; i++) {
      ids.push(
        computeBundleId({
          mappingVersion: `v${i}`,
          configVersion: 'v4',
          containerId: 'GTM-ABCD',
          events: randomEvents(i, 5),
          generatedAt: '2026-05-13T19:30:00.000Z',
        }),
      );
    }
    // Compteur des premiers chars
    const firstCharFreq: Record<string, number> = {};
    for (const id of ids) {
      firstCharFreq[id[0]!] = (firstCharFreq[id[0]!] ?? 0) + 1;
    }
    // 16 chars hex → distribution attendue ~1000/16 = 62 par char. Tolère 30-200.
    for (const count of Object.values(firstCharFreq)) {
      expect(count).toBeGreaterThan(20);
      expect(count).toBeLessThan(200);
    }
  });

  it('aucune collision sur 10000 entrées différenciées par 1 char', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10000; i++) {
      ids.add(
        computeBundleId({
          mappingVersion: 'v17',
          configVersion: 'v4',
          containerId: 'GTM-ABCD',
          events: [{ name: `purchase_${i}`, resolvedNames: { meta: 'Purchase' } }],
          generatedAt: '2026-05-13T19:30:00.000Z',
        }),
      );
    }
    expect(ids.size).toBe(10000);
  });
});

describe('isValidBundleId — fuzz', () => {
  const cases: Array<[unknown, boolean]> = [
    ['a7c4f2e9b81d', true],
    ['000000000000', true],
    ['ffffffffffff', true],
    ['A7C4F2E9B81D', false], // uppercase rejected
    ['a7c4f2e9b81', false], // 11 chars
    ['a7c4f2e9b81dd', false], // 13 chars
    ['a7c4f2e9b81g', false], // 'g' not hex
    [' a7c4f2e9b81d', false], // leading space
    ['a7c4f2e9b81d ', false], // trailing space
    [null, false],
    [undefined, false],
    [123, false],
    [{}, false],
    [[], false],
    [true, false],
    [Symbol('x'), false],
  ];

  it.each(cases)('isValidBundleId(%o) → %s', (input, expected) => {
    expect(isValidBundleId(input)).toBe(expected);
  });
});
