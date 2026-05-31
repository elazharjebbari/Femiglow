/**
 * Test d'intégration — `mockAdapter.getMaisonPageContent({ locale })`
 * retourne le bon contenu pour chaque locale (Phase 3 T3.6).
 *
 * Garantit que la chaîne `cms → pickByLocale → maisonByLocale` est
 * câblée correctement : FR, AR, EN doivent chacune retourner leur propre
 * hero title. Pattern strictement identique à `homepage-locale.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import { mockAdapter } from './index';

describe('mockAdapter.getMaisonPageContent — locale dispatch', () => {
  it('FR : retourne le hero français', async () => {
    const content = await mockAdapter.getMaisonPageContent({ locale: 'fr' });
    expect(content.hero.title).toBe('La maison d’éclat.');
    expect(content.hero.kicker).toBe('La maison');
  });

  it('AR : retourne le hero arabe (MSA féminin)', async () => {
    const content = await mockAdapter.getMaisonPageContent({ locale: 'ar' });
    // Caractères arabes présents
    expect(content.hero.title).toMatch(/[؀-ۿ]/);
    expect(content.hero.title).toBe('دار الإشراق.');
    // CTA en arabe — verbe au féminin (اكتشفي)
    expect(content.hero.cta?.label).toMatch(/اكتشفي/);
    // Lexique maison : `الدار` (et non « البيت »)
    expect(content.hero.kicker).toBe('الدار');
  });

  it('EN : retourne le hero anglais', async () => {
    const content = await mockAdapter.getMaisonPageContent({ locale: 'en' });
    expect(content.hero.title).toBe('The maison of quiet glow.');
    // "maison" préservé comme nom propre intraduisible
    expect(content.hero.subtitle).toMatch(/maison/);
    expect(content.hero.kicker).toBe('The maison');
  });

  it('default (no options) → FR', async () => {
    const content = await mockAdapter.getMaisonPageContent();
    expect(content.hero.title).toBe('La maison d’éclat.');
  });

  it('shape MaisonPageContent strictement préservée sur les 3 locales', async () => {
    const [fr, ar, en] = await Promise.all([
      mockAdapter.getMaisonPageContent({ locale: 'fr' }),
      mockAdapter.getMaisonPageContent({ locale: 'ar' }),
      mockAdapter.getMaisonPageContent({ locale: 'en' }),
    ]);
    // Toutes ont les mêmes top-level keys
    expect(Object.keys(fr).sort()).toEqual(Object.keys(ar).sort());
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    // Toutes ont le même nombre de matières (4), engagements (6),
    // crossLinks (3)
    expect(ar.matieres.length).toBe(fr.matieres.length);
    expect(en.matieres.length).toBe(fr.matieres.length);
    expect(ar.engagements.length).toBe(fr.engagements.length);
    expect(en.engagements.length).toBe(fr.engagements.length);
    expect(ar.crossLinks.length).toBe(fr.crossLinks.length);
    expect(en.crossLinks.length).toBe(fr.crossLinks.length);
    // crossLinks slugs (hrefs) partagés entre locales (cf. ADR-002)
    expect(ar.crossLinks.map((c) => c.href)).toEqual(
      fr.crossLinks.map((c) => c.href),
    );
    expect(en.crossLinks.map((c) => c.href)).toEqual(
      fr.crossLinks.map((c) => c.href),
    );
  });

  it('voix FemiGlow respectée : aucun emoji, aucun "!" marketing', async () => {
    const [fr, ar, en] = await Promise.all([
      mockAdapter.getMaisonPageContent({ locale: 'fr' }),
      mockAdapter.getMaisonPageContent({ locale: 'ar' }),
      mockAdapter.getMaisonPageContent({ locale: 'en' }),
    ]);
    const allTexts = [fr, ar, en].flatMap((m) => [
      m.hero.title,
      m.hero.subtitle ?? '',
      m.hero.cta?.label ?? '',
      m.origine.titre,
      ...m.origine.paragraphs,
      m.fondatrice.titre,
      ...m.fondatrice.paragraphs,
      ...m.atelier.description,
      ...m.matieres.map((mat) => mat.pourquoi),
      ...m.engagements.map((e) => e.description),
    ]);
    for (const text of allTexts) {
      // Emojis Unicode (Misc Symbols + Emoticons)
      expect(text).not.toMatch(/[\u{1F600}-\u{1F64F}\u{2600}-\u{27BF}]/u);
      // Pas de "!" marketing en fin/milieu de phrase
      expect(text).not.toMatch(/(?<![/\\:])\s*!\s*(?:$|\s)/);
    }
  });

  it('AR : adresse féminine sur les CTAs (impératifs féminins)', async () => {
    const ar = await mockAdapter.getMaisonPageContent({ locale: 'ar' });
    // Les CTAs de crossLinks contiennent des verbes féminins (terminaison ـي)
    const rituelLink = ar.crossLinks.find((c) => c.id === 'rituel');
    const kitLink = ar.crossLinks.find((c) => c.id === 'kit');
    expect(rituelLink?.titre).toMatch(/اقرئي/); // « lis » féminin
    expect(kitLink?.titre).toMatch(/تصفّحي/); // « parcours » féminin
  });
});
