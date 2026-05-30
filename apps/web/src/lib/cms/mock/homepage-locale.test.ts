/**
 * Test d'intégration — `mockAdapter.getHomepageContent({ locale })` retourne
 * le bon contenu pour chaque locale (Phase 3 T3.5).
 *
 * Garantit que la chaîne `cms → pickByLocale → homepageByLocale` est câblée
 * correctement : FR, AR, EN doivent chacune retourner leur propre hero title.
 */
import { describe, expect, it } from 'vitest';

import { mockAdapter } from './index';

describe('mockAdapter.getHomepageContent — locale dispatch', () => {
  it('FR : retourne le hero français', async () => {
    const content = await mockAdapter.getHomepageContent({ locale: 'fr' });
    expect(content.hero.title).toBe(
      'Le pack FemiGlow. Deux gestes, un éclat révélé.',
    );
    expect(content.hero.cta!.label).toBe('Découvrir le rituel');
  });

  it('AR : retourne le hero arabe (MSA féminin)', async () => {
    const content = await mockAdapter.getHomepageContent({ locale: 'ar' });
    // Le titre doit contenir des caractères arabes
    expect(content.hero.title).toMatch(/[؀-ۿ]/);
    expect(content.hero.title).toBe('كيت فيمي قلو. حركتان، إشراق مكشوف.');
    // CTA en arabe — verbe au féminin (اكتشفي)
    expect(content.hero.cta!.label).toBe('اكتشفي الطقوس');
  });

  it('EN : retourne le hero anglais', async () => {
    const content = await mockAdapter.getHomepageContent({ locale: 'en' });
    expect(content.hero.title).toBe(
      'The FemiGlow kit. Two gestures, a revealed glow.',
    );
    expect(content.hero.cta!.label).toBe('Discover the ritual');
  });

  it('default (no options) → FR', async () => {
    const content = await mockAdapter.getHomepageContent();
    expect(content.hero.cta!.label).toBe('Découvrir le rituel');
  });

  it('locale=fr produit le même output que l’absence d’options', async () => {
    const a = await mockAdapter.getHomepageContent();
    const b = await mockAdapter.getHomepageContent({ locale: 'fr' });
    expect(a).toEqual(b);
  });

  it('shape HomepageContent strictement préservée sur les 3 locales', async () => {
    const [fr, ar, en] = await Promise.all([
      mockAdapter.getHomepageContent({ locale: 'fr' }),
      mockAdapter.getHomepageContent({ locale: 'ar' }),
      mockAdapter.getHomepageContent({ locale: 'en' }),
    ]);
    // Toutes ont les mêmes top-level keys
    expect(Object.keys(fr).sort()).toEqual(Object.keys(ar).sort());
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    // Toutes ont le même nombre de gestes (3) et d'avis (3)
    expect(ar.gestes.length).toBe(fr.gestes.length);
    expect(en.gestes.length).toBe(fr.gestes.length);
    expect(ar.avis.length).toBe(fr.avis.length);
    expect(en.avis.length).toBe(fr.avis.length);
    // Slugs d'articles partagés entre locales (cf. ADR-002)
    expect(ar.journalExtraitsSlugs).toEqual(fr.journalExtraitsSlugs);
    expect(en.journalExtraitsSlugs).toEqual(fr.journalExtraitsSlugs);
  });

  it('voix FemiGlow respectée : aucun emoji, aucun "!" marketing', async () => {
    const [fr, ar, en] = await Promise.all([
      mockAdapter.getHomepageContent({ locale: 'fr' }),
      mockAdapter.getHomepageContent({ locale: 'ar' }),
      mockAdapter.getHomepageContent({ locale: 'en' }),
    ]);
    const allTexts = [fr, ar, en].flatMap((h) => [
      h.hero.title,
      h.hero.subtitle,
      h.hero.cta!.label,
      h.manifeste.title,
      ...h.manifeste.paragraphs,
      ...h.avis.map((a) => a.quote),
    ]);
    for (const text of allTexts) {
      // Emojis Unicode (Misc Symbols + Emoticons)
      expect(text).not.toMatch(/[\u{1F600}-\u{1F64F}\u{2600}-\u{27BF}]/u);
      // Pas de "!" marketing en fin/milieu de phrase (test heuristique)
      expect(text).not.toMatch(/(?<![/\\:])\s*!\s*(?:$|\s)/);
    }
  });
});
