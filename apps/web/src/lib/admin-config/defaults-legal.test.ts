/**
 * Vérifie que la nav admin-config et la matrice RBAC incluent bien
 * l'entrée 'legal' (P9.1 + P9.6), et que le schema Zod accepte les
 * defaults sans erreur.
 */
import { describe, expect, it } from 'vitest';

import { navDefault, rbacDefault } from './defaults';
import { navSchema, rbacSchema, RBAC_RESOURCES } from './schemas';

describe('navDefault — entrée legal', () => {
  it('contient une entrée key="legal" pointant vers /admin/legal', () => {
    const legal = navDefault.items.find((i) => i.key === 'legal');
    expect(legal).toBeDefined();
    expect(legal?.href).toBe('/admin/legal');
    expect(legal?.label).toBe('Pages légales');
  });

  it('positions strictement croissantes et uniques', () => {
    const positions = navDefault.items.map((i) => i.position);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('passe la validation Zod navSchema', () => {
    const r = navSchema.safeParse(navDefault);
    expect(r.success).toBe(true);
  });

  it('aucun key dupliqué', () => {
    const keys = navDefault.items.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('max 20 items respecté', () => {
    expect(navDefault.items.length).toBeLessThanOrEqual(20);
  });
});

describe('rbacDefault — resource legal', () => {
  it('superadmin a toutes les actions sur legal', () => {
    const sa = rbacDefault.matrix.superadmin!;
    expect(sa.legal).toEqual(
      expect.arrayContaining(['read', 'write', 'publish', 'delete']),
    );
  });

  it('admin a read/write/publish (pas delete) sur legal', () => {
    const ad = rbacDefault.matrix.admin!;
    expect(ad.legal).toEqual(['read', 'write', 'publish']);
  });

  it('editor a read/write (pas publish ni delete) sur legal', () => {
    const ed = rbacDefault.matrix.editor!;
    expect(ed.legal).toEqual(['read', 'write']);
  });

  it('viewer a uniquement read sur legal', () => {
    const v = rbacDefault.matrix.viewer!;
    expect(v.legal).toEqual(['read']);
  });

  it('RBAC_RESOURCES contient "legal"', () => {
    expect(RBAC_RESOURCES).toContain('legal');
  });

  it('rbacDefault passe la validation Zod rbacSchema', () => {
    const r = rbacSchema.safeParse(rbacDefault);
    expect(r.success).toBe(true);
  });
});
