/**
 * Tests du registry — pas d'I/O DB, on vérifie seulement les invariants
 * structurels du registre.
 */
import { describe, it, expect } from 'vitest';
import {
  SEEDERS_REGISTRY,
  getSeedersByIds,
  getAllSeeders,
  getSeederIds,
  getTotalEstimatedDurationMs,
} from './registry';

describe('seeders/registry', () => {
  it('expose au moins 15 seeders', () => {
    expect(SEEDERS_REGISTRY.length).toBeGreaterThanOrEqual(15);
  });

  it('chaque id est unique', () => {
    const ids = SEEDERS_REGISTRY.map((s) => s.id);
    const set = new Set(ids);
    expect(set.size).toBe(ids.length);
  });

  it('chaque seeder a un id, label, description, run, group et estimatedDurationMs > 0', () => {
    for (const s of SEEDERS_REGISTRY) {
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
      expect(typeof s.run).toBe('function');
      expect(['core', 'commerce', 'content', 'chat', 'tracking']).toContain(
        s.group,
      );
      expect(s.estimatedDurationMs).toBeGreaterThan(0);
    }
  });

  it('couvre les 5 groupes attendus', () => {
    const groups = new Set(SEEDERS_REGISTRY.map((s) => s.group));
    expect(groups).toEqual(
      new Set(['core', 'commerce', 'content', 'chat', 'tracking']),
    );
  });

  it('inclut les seeders critiques (par id)', () => {
    const ids = getSeederIds();
    const expected = [
      'app-config-navigation',
      'app-config-flags',
      'app-config-rbac',
      'app-config-branding',
      'form-config',
      'products',
      'delivery-cities',
      'seo',
      'components',
      'media',
      'chat-instructions',
      'chat-theme',
      'chat-providers',
      'tracking',
      'rituals',
    ];
    for (const id of expected) {
      expect(ids).toContain(id);
    }
  });

  it('getSeedersByIds filtre + préserve l’ordre du registry', () => {
    const ids = ['products', 'app-config-flags', 'seo'];
    const out = getSeedersByIds(ids);
    // ordre du registry : flags vient avant products vient avant seo
    expect(out.map((s) => s.id)).toEqual([
      'app-config-flags',
      'products',
      'seo',
    ]);
  });

  it('getSeedersByIds ignore les ids inconnus', () => {
    const out = getSeedersByIds(['unknown-foo', 'seo']);
    expect(out.map((s) => s.id)).toEqual(['seo']);
  });

  it('getAllSeeders renvoie une liste non-vide', () => {
    expect(getAllSeeders().length).toBe(SEEDERS_REGISTRY.length);
  });

  it('getTotalEstimatedDurationMs calcule la somme', () => {
    const all = getTotalEstimatedDurationMs();
    expect(all).toBeGreaterThan(0);
    const sub = getTotalEstimatedDurationMs(['products', 'seo']);
    const sum =
      SEEDERS_REGISTRY.find((s) => s.id === 'products')!.estimatedDurationMs +
      SEEDERS_REGISTRY.find((s) => s.id === 'seo')!.estimatedDurationMs;
    expect(sub).toBe(sum);
  });
});
