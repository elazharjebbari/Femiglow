/**
 * N05 — Config nav par défaut ↔ navSchema.
 *
 * Garantit que la nav par défaut (source de vérité config) est valide, cohérente
 * et contient l'onglet Coupons. cf. docs/admin-nav-coupons-qa-2026-06-03/N05.
 */
import { describe, expect, it } from 'vitest';
import { navDefault, getDefault } from './defaults';
import { navSchema, navItemSchema } from './schemas';

describe('N05 navDefault ↔ navSchema', () => {
  it('N05-U001 navDefault valide navSchema', () => {
    expect(navSchema.safeParse(navDefault).success).toBe(true);
  });

  it('N05-U002 getDefault("nav") === navDefault', () => {
    expect(getDefault('nav')).toEqual(navDefault);
  });

  it('N05-U003 clés uniques', () => {
    const keys = navDefault.items.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('N05-U004 onglet Coupons présent (key/label/href)', () => {
    const coupons = navDefault.items.find((i) => i.key === 'coupons');
    expect(coupons).toBeDefined();
    expect(coupons).toMatchObject({ label: 'Coupons', href: '/admin/coupons' });
  });

  it('N05-U005 positions entières croissantes et contiguës (0..n-1 après tri)', () => {
    const positions = navDefault.items.map((i) => i.position).sort((a, b) => a - b);
    positions.forEach((p, i) => expect(p).toBe(i));
  });

  it('N05-U006 superRefine : clé dupliquée rejetée', () => {
    const dup = { items: [
      { key: 'a', label: 'A', href: '/admin/a', icon: 'box', position: 0 },
      { key: 'a', label: 'B', href: '/admin/b', icon: 'box', position: 1 },
    ] };
    expect(navSchema.safeParse(dup).success).toBe(false);
  });

  it('N05-U007 strict : clé inconnue sur un item rejetée', () => {
    const bad = { key: 'x', label: 'X', href: '/admin/x', icon: 'box', position: 0, extra: 1 };
    expect(navItemSchema.safeParse(bad).success).toBe(false);
  });

  it('N05-U008 href doit commencer par / (regex)', () => {
    const bad = { key: 'x', label: 'X', href: 'admin/x', icon: 'box', position: 0 };
    expect(navItemSchema.safeParse(bad).success).toBe(false);
  });

  it('N05-U009 max 20 items', () => {
    const items = Array.from({ length: 21 }, (_, i) => ({
      key: `k${i}`, label: `L${i}`, href: `/admin/k${i}`, icon: 'box', position: i,
    }));
    expect(navSchema.safeParse({ items }).success).toBe(false);
  });
});
