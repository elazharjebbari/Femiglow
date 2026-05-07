/**
 * Tests unitaires — registre statique des composants.
 *
 * Vérifie :
 *  - Les clés sont uniques.
 *  - Les slot keys sont uniques au sein d'un même composant.
 *  - Les heroes ont `defaultLoadingStrategy=eager` + `fetchPriority=high`.
 *  - findComponentSeed/listComponentKeys cohérents.
 */
import { describe, it, expect } from 'vitest';
import {
  SITE_COMPONENT_REGISTRY,
  findComponentSeed,
  listComponentKeys,
} from './registry';

describe('SITE_COMPONENT_REGISTRY', () => {
  it('toutes les clés (key) sont uniques', () => {
    const keys = SITE_COMPONENT_REGISTRY.map((c) => c.key);
    const set = new Set(keys);
    expect(keys.length).toBe(set.size);
  });

  it('au sein d’un composant, les slot keys sont uniques', () => {
    for (const c of SITE_COMPONENT_REGISTRY) {
      const slotKeys = c.slots.map((s) => s.key);
      expect(new Set(slotKeys).size, `${c.key} a des slot keys dupliqués`).toBe(
        slotKeys.length,
      );
    }
  });

  it('les heroes (category=hero) sont eager + fetchPriority=high', () => {
    const heroes = SITE_COMPONENT_REGISTRY.filter((c) => c.category === 'hero');
    expect(heroes.length).toBeGreaterThan(0);
    for (const h of heroes) {
      expect(h.defaultLoadingStrategy, `${h.key} loading`).toBe('eager');
      expect(h.defaultFetchPriority, `${h.key} priority`).toBe('high');
    }
  });

  it('toutes les entrées ont au moins une slot avec acceptKinds non vide', () => {
    for (const c of SITE_COMPONENT_REGISTRY) {
      for (const s of c.slots) {
        expect(
          s.acceptKinds.length,
          `${c.key}/${s.key} acceptKinds vide`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('toutes les entrées ont un pageGroup connu', () => {
    const valid = new Set(['home', 'rituel', 'kit', 'maison', 'journal', 'shared']);
    for (const c of SITE_COMPONENT_REGISTRY) {
      expect(valid.has(c.pageGroup), `${c.key} pageGroup=${c.pageGroup}`).toBe(true);
    }
  });
});

describe('findComponentSeed / listComponentKeys', () => {
  it('findComponentSeed retourne le seed exact pour une clé connue', () => {
    const first = SITE_COMPONENT_REGISTRY[0]!;
    const found = findComponentSeed(first.key);
    expect(found).toEqual(first);
  });

  it('findComponentSeed retourne undefined pour une clé inconnue', () => {
    expect(findComponentSeed('inexistant-xyz')).toBeUndefined();
  });

  it('listComponentKeys couvre toutes les entrées', () => {
    expect(listComponentKeys().sort()).toEqual(
      SITE_COMPONENT_REGISTRY.map((c) => c.key).sort(),
    );
  });
});
