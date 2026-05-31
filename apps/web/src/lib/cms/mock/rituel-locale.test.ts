/**
 * Test d'intégration — `mockAdapter.getRituelPageContent({ locale })`
 * retourne le bon contenu pour chaque locale (Phase 3 T3.6).
 *
 * Garantit que la chaîne `cms → pickByLocale → rituelByLocale` est
 * câblée correctement. Pattern strictement identique à
 * `homepage-locale.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import { mockAdapter } from './index';

describe('mockAdapter.getRituelPageContent — locale dispatch', () => {
  it('FR : retourne le hero français', async () => {
    const content = await mockAdapter.getRituelPageContent({ locale: 'fr' });
    expect(content.hero.title).toBe(
      'Manucure japonaise. Deux gestes. Un éclat lent.',
    );
    expect(content.pivot.cta.label).toBe('Recevoir le pack — 199 dh');
  });

  it('AR : retourne le hero arabe (MSA féminin)', async () => {
    const content = await mockAdapter.getRituelPageContent({ locale: 'ar' });
    expect(content.hero.title).toMatch(/[؀-ۿ]/);
    expect(content.hero.title).toBe('مانيكور ياباني. حركتان. إشراقة بطيئة.');
    // CTA pivot — verbe au féminin (استلمي)
    expect(content.pivot.cta.label).toMatch(/استلمي/);
    // Devise localisée en arabe : « درهم » (dirham), pas le code latin « MAD ».
    expect(content.pivot.cta.label).toMatch(/درهم/);
  });

  it('EN : retourne le hero anglais', async () => {
    const content = await mockAdapter.getRituelPageContent({ locale: 'en' });
    expect(content.hero.title).toBe(
      'Japanese manicure. Two gestures. A slow glow.',
    );
    expect(content.pivot.cta.label).toBe('Receive the pack — 199 MAD');
  });

  it('default (no options) → FR', async () => {
    const content = await mockAdapter.getRituelPageContent();
    expect(content.hero.title).toBe(
      'Manucure japonaise. Deux gestes. Un éclat lent.',
    );
  });

  it('shape RituelPageContent strictement préservée sur les 3 locales', async () => {
    const [fr, ar, en] = await Promise.all([
      mockAdapter.getRituelPageContent({ locale: 'fr' }),
      mockAdapter.getRituelPageContent({ locale: 'ar' }),
      mockAdapter.getRituelPageContent({ locale: 'en' }),
    ]);
    expect(Object.keys(fr).sort()).toEqual(Object.keys(ar).sort());
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    // 3 micro-essais sciences, 5 questions interview
    expect(ar.sciences.essais.length).toBe(fr.sciences.essais.length);
    expect(en.sciences.essais.length).toBe(fr.sciences.essais.length);
    expect(ar.interview.questions.length).toBe(fr.interview.questions.length);
    expect(en.interview.questions.length).toBe(fr.interview.questions.length);
    // Slugs partagés entre locales (cf. ADR-002)
    expect(ar.journalCrossSlugs).toEqual(fr.journalCrossSlugs);
    expect(en.journalCrossSlugs).toEqual(fr.journalCrossSlugs);
  });

  it('voix FemiGlow respectée : aucun emoji, aucun "!" marketing', async () => {
    const [fr, ar, en] = await Promise.all([
      mockAdapter.getRituelPageContent({ locale: 'fr' }),
      mockAdapter.getRituelPageContent({ locale: 'ar' }),
      mockAdapter.getRituelPageContent({ locale: 'en' }),
    ]);
    const allTexts = [fr, ar, en].flatMap((r) => [
      r.hero.title,
      r.hero.subtitle ?? '',
      r.origine.titre,
      ...r.origine.paragraphes,
      r.sciences.titre,
      ...r.sciences.essais.map((e) => e.paragraphe),
      r.interview.introduction,
      ...r.interview.questions.flatMap((q) => [q.question, q.reponse]),
      r.pivot.phrase,
      r.pivot.cta.label,
    ]);
    for (const text of allTexts) {
      expect(text).not.toMatch(/[\u{1F600}-\u{1F64F}\u{2600}-\u{27BF}]/u);
      expect(text).not.toMatch(/(?<![/\\:])\s*!\s*(?:$|\s)/);
    }
  });

  it('AR : termes de marque préservés en latin (Paste, Powder, Step 4, INCI)', async () => {
    const ar = await mockAdapter.getRituelPageContent({ locale: 'ar' });
    // Au moins une occurrence latine de chaque terme dans le contenu
    const fullText = [
      ar.sciences.essais.map((e) => e.paragraphe).join(' '),
      ar.interview.questions.map((q) => q.reponse).join(' '),
      ar.videoGestes.chapters?.map((c) => c.label).join(' ') ?? '',
    ].join(' ');
    expect(fullText).toMatch(/Step 4/);
    expect(fullText).toMatch(/INCI/);
    expect(fullText).toMatch(/Paste/);
  });
});
