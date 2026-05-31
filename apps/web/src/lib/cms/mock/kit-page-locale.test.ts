/**
 * Test d'intégration — `mockAdapter.getKitPageContent({ locale })`
 * retourne le bon contenu pour chaque locale (Phase 3 T3.6).
 *
 * Garantit que la chaîne `cms → pickByLocale → kitPageByLocale` est
 * câblée correctement. Pattern strictement identique à
 * `homepage-locale.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import { kitPageContentSchema } from '@/lib/schemas';

import { mockAdapter } from './index';

describe('mockAdapter.getKitPageContent — locale dispatch', () => {
  it('FR : retourne le produit français', async () => {
    const content = await mockAdapter.getKitPageContent({ locale: 'fr' });
    expect(content.product.name).toBe('Pack FemiGlow');
    expect(content.comparatif.titreRituel).toBe('Pack FemiGlow');
  });

  it('AR : retourne le produit arabe (MSA féminin)', async () => {
    const content = await mockAdapter.getKitPageContent({ locale: 'ar' });
    expect(content.product.name).toMatch(/[؀-ۿ]/);
    expect(content.product.name).toBe('كيت FemiGlow');
    // Marque préservée en latin
    expect(content.product.name).toMatch(/FemiGlow/);
    // FAQ : interrogation féminine (هل أستطيع → adresse féminine)
    const compatibilite = content.faq.find((f) => f.id === 'compatibilite-vernis');
    expect(compatibilite?.question).toMatch(/أستطيع/);
  });

  it('EN : retourne le produit anglais', async () => {
    const content = await mockAdapter.getKitPageContent({ locale: 'en' });
    expect(content.product.name).toBe('FemiGlow pack');
    expect(content.comparatif.titreRituel).toBe('FemiGlow pack');
  });

  it('default (no options) → FR', async () => {
    const content = await mockAdapter.getKitPageContent();
    expect(content.product.name).toBe('Pack FemiGlow');
  });

  it('shape KitPageContent strictement préservée sur les 3 locales', async () => {
    const [fr, ar, en] = await Promise.all([
      mockAdapter.getKitPageContent({ locale: 'fr' }),
      mockAdapter.getKitPageContent({ locale: 'ar' }),
      mockAdapter.getKitPageContent({ locale: 'en' }),
    ]);
    expect(Object.keys(fr).sort()).toEqual(Object.keys(ar).sort());
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    // Compositions identiques (3 sous-produits), FAQ identique (8 items),
    // témoignages (3), comparatif (6 lignes), réassurances (3)
    expect(ar.composition.length).toBe(fr.composition.length);
    expect(en.composition.length).toBe(fr.composition.length);
    expect(ar.faq.length).toBe(fr.faq.length);
    expect(en.faq.length).toBe(fr.faq.length);
    expect(ar.comparatif.rows.length).toBe(fr.comparatif.rows.length);
    expect(en.comparatif.rows.length).toBe(fr.comparatif.rows.length);
    expect(ar.handsTestimonials.length).toBe(fr.handsTestimonials.length);
    expect(en.handsTestimonials.length).toBe(fr.handsTestimonials.length);
    // Prix inchangés (ne se traduit pas)
    expect(ar.product.priceCents).toBe(fr.product.priceCents);
    expect(en.product.priceCents).toBe(fr.product.priceCents);
    // Slugs partagés (cf. ADR-002)
    expect(ar.journalCrossSlugs).toEqual(fr.journalCrossSlugs);
    expect(en.journalCrossSlugs).toEqual(fr.journalCrossSlugs);
  });

  it('AR et EN passent la validation kitPageContentSchema', async () => {
    const [ar, en] = await Promise.all([
      mockAdapter.getKitPageContent({ locale: 'ar' }),
      mockAdapter.getKitPageContent({ locale: 'en' }),
    ]);
    // Le schéma Zod valide structurellement chaque locale (sensation et
    // narrative doivent toujours se terminer par une ponctuation finale).
    expect(() => kitPageContentSchema.parse(ar)).not.toThrow();
    expect(() => kitPageContentSchema.parse(en)).not.toThrow();
  });

  it('voix FemiGlow respectée : aucun emoji, aucun "!" marketing', async () => {
    const [fr, ar, en] = await Promise.all([
      mockAdapter.getKitPageContent({ locale: 'fr' }),
      mockAdapter.getKitPageContent({ locale: 'ar' }),
      mockAdapter.getKitPageContent({ locale: 'en' }),
    ]);
    const allTexts = [fr, ar, en].flatMap((k) => [
      k.product.name,
      k.product.tagline,
      k.product.description,
      ...k.composition.map((c) => c.shortDescription),
      ...k.composition.map((c) => c.narrative ?? ''),
      ...k.faq.flatMap((f) => [f.question, f.answer]),
      ...k.handsTestimonials.map((t) => t.quote),
      ...k.comparatif.rows.flatMap((r) => [r.vernis, r.rituel]),
    ]);
    for (const text of allTexts) {
      expect(text).not.toMatch(/[\u{1F600}-\u{1F64F}\u{2600}-\u{27BF}]/u);
      expect(text).not.toMatch(/(?<![/\\:])\s*!\s*(?:$|\s)/);
    }
  });
});
