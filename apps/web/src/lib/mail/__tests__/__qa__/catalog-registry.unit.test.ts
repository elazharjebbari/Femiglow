/**
 * CHANTIER H — Module 08 : test génératif sur le registre de templates.
 *
 * Oracle : pour CHAQUE template du `TEMPLATE_REGISTRY`, le schéma Zod est
 * valide, la meta est cohérente (slug==clé, catégorie connue, version entière
 * positive), `sampleData` valide contre son schéma, `subjectFn`/`preheaderFn`
 * ne jettent pas et renvoient des chaînes non vides bornées, et un payload
 * VOLONTAIREMENT invalide est bien REJETÉ par le schéma (le schéma discrimine).
 *
 * IDs matrice : volet « catalog » (chaque template a un schéma Zod valide + meta
 * cohérente — génératif sur le registre).
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { TEMPLATE_REGISTRY } from '../../catalog';

const VALID_CATEGORIES = new Set(['transactional', 'broadcast', 'automation']);
const entries = Object.entries(TEMPLATE_REGISTRY);

describe('TEMPLATE_REGISTRY — intégrité génératif (Module 08)', () => {
  it('le registre n est pas vide', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  describe.each(entries)('template %s', (slug, meta) => {
    it('clé du registre == meta.slug', () => {
      expect(meta.slug).toBe(slug);
    });

    it('expose un schéma Zod (instance ZodType)', () => {
      expect(meta.schema).toBeInstanceOf(z.ZodType);
    });

    it('catégorie connue', () => {
      expect(VALID_CATEGORIES.has(meta.category)).toBe(true);
    });

    it('version = entier strictement positif', () => {
      expect(Number.isInteger(meta.version)).toBe(true);
      expect(meta.version).toBeGreaterThan(0);
    });

    it('displayName et description non vides', () => {
      expect(meta.displayName.trim().length).toBeGreaterThan(0);
      expect(meta.description.trim().length).toBeGreaterThan(0);
    });

    it('sampleData valide contre son propre schéma', () => {
      const parsed = meta.schema.safeParse(meta.sampleData);
      expect(parsed.success, `sampleData de ${slug} doit valider`).toBe(true);
    });

    it('subjectFn(sampleData) → string non vide < 200 chars', () => {
      const subject = meta.subjectFn(meta.sampleData as never);
      expect(typeof subject).toBe('string');
      expect(subject.length).toBeGreaterThan(0);
      expect(subject.length).toBeLessThan(200);
    });

    it('preheaderFn (si défini) → string non vide', () => {
      if (!meta.preheaderFn) return; // optionnel
      const pre = meta.preheaderFn(meta.sampleData as never);
      expect(typeof pre).toBe('string');
      expect(pre.length).toBeGreaterThan(0);
    });

    it('déclare au moins une variable, chacune nommée + labellée + samplée', () => {
      expect(meta.variables.length).toBeGreaterThan(0);
      for (const v of meta.variables) {
        expect(v.name.trim()).toBeTruthy();
        expect(v.label.trim()).toBeTruthy();
        expect(String(v.sample).trim()).toBeTruthy();
      }
    });

    it('le schéma DISCRIMINE : un payload vide est rejeté', () => {
      // Un objet vide ne satisfait aucun de nos schémas (tous ont >=1 champ
      // requis), prouvant que le schéma valide réellement quelque chose.
      const parsed = meta.schema.safeParse({});
      expect(parsed.success).toBe(false);
    });
  });

  it('slugs uniques dans le registre', () => {
    const slugs = entries.map(([, m]) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
