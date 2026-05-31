/**
 * Tests d'intégration — Articles localisés (Phase 3 T3.7).
 *
 * Vérifie la chaîne `cms → pickByLocale → articlesByLocale` pour les 4
 * méthodes article :
 *  - `getArticles({ locale })`
 *  - `getArticlesPage({ locale })`
 *  - `getArticleBySlug(slug, { locale })`
 *  - `getRelatedArticles(slug, limit, { locale })`
 *
 * Les invariants critiques (parité de count, slugs ADR-002, voix maison)
 * sont vérifiés sur les 3 locales en parallèle.
 *
 * Inspiré de `homepage-locale.test.ts` (T3.5).
 */
import { describe, expect, it } from 'vitest';

import { mockAdapter } from './index';

describe('mockAdapter — articles locale dispatch', () => {
  it('getArticleBySlug FR : retourne le titre français canonical', async () => {
    const article = await mockAdapter.getArticleBySlug(
      'hiver-ongles-patience',
      { locale: 'fr' },
    );
    expect(article).not.toBeNull();
    expect(article!.title).toBe('Hiver, ongles, patience');
    expect(article!.kicker).toBe('Saison');
  });

  it('getArticleBySlug AR : retourne le titre arabe (MSA)', async () => {
    const article = await mockAdapter.getArticleBySlug(
      'hiver-ongles-patience',
      { locale: 'ar' },
    );
    expect(article).not.toBeNull();
    // Le titre doit contenir des caractères arabes
    expect(article!.title).toMatch(/[؀-ۿ]/);
    expect(article!.title).toBe('الشتاء، الأظافر، الصبر');
    // Author bilingue → équipe traduite
    expect(article!.author.name).toBe('فريق FemiGlow');
  });

  it('getArticleBySlug EN : retourne le titre anglais (sentence case)', async () => {
    const article = await mockAdapter.getArticleBySlug(
      'hiver-ongles-patience',
      { locale: 'en' },
    );
    expect(article).not.toBeNull();
    expect(article!.title).toBe('Winter, nails, patience');
    expect(article!.author.name).toBe('The FemiGlow team');
  });

  it('getArticles({ limit: 3, locale: "ar" }) : 3 articles AR', async () => {
    const items = await mockAdapter.getArticles({ limit: 3, locale: 'ar' });
    expect(items).toHaveLength(3);
    // Chaque titre doit contenir au moins un caractère arabe
    for (const a of items) {
      expect(a.title).toMatch(/[؀-ۿ]/);
    }
  });

  it('parité de count et d’ordre entre FR / AR / EN', async () => {
    const [fr, ar, en] = await Promise.all([
      mockAdapter.getArticles({ locale: 'fr' }),
      mockAdapter.getArticles({ locale: 'ar' }),
      mockAdapter.getArticles({ locale: 'en' }),
    ]);
    expect(ar).toHaveLength(fr.length);
    expect(en).toHaveLength(fr.length);
    // Slugs identiques et dans le même ordre (les 3 sont triés par publishedAt
    // desc, donc l'ordre est imposé par les dates partagées).
    expect(ar.map((a) => a.slug)).toEqual(fr.map((a) => a.slug));
    expect(en.map((a) => a.slug)).toEqual(fr.map((a) => a.slug));
  });

  it('getRelatedArticles AR : retourne des articles AR de la même catégorie', async () => {
    const related = await mockAdapter.getRelatedArticles(
      'hiver-ongles-patience',
      3,
      { locale: 'ar' },
    );
    expect(related.length).toBeGreaterThan(0);
    expect(related.length).toBeLessThanOrEqual(3);
    // Pas l'article source dans la liste
    expect(related.every((a) => a.slug !== 'hiver-ongles-patience')).toBe(true);
    // Tous les titres en arabe
    for (const a of related) {
      expect(a.title).toMatch(/[؀-ۿ]/);
    }
  });

  it('voix FemiGlow respectée : aucun emoji, aucun "!" marketing dans les 3 locales', async () => {
    const [fr, ar, en] = await Promise.all([
      mockAdapter.getArticles({ locale: 'fr' }),
      mockAdapter.getArticles({ locale: 'ar' }),
      mockAdapter.getArticles({ locale: 'en' }),
    ]);
    const textsFromArticle = (a: (typeof fr)[number]) => [
      a.title,
      a.kicker ?? '',
      a.excerpt,
      a.author.name,
      a.author.bio ?? '',
      a.featuredImage.alt,
      // Body inclus — voix éditoriale stricte sur tout le contenu
      a.body,
    ];
    const allTexts = [...fr, ...ar, ...en].flatMap(textsFromArticle);
    for (const text of allTexts) {
      // Emojis Unicode (Misc Symbols + Emoticons)
      expect(text).not.toMatch(/[\u{1F600}-\u{1F64F}\u{2600}-\u{27BF}]/u);
      // Pas de "!" marketing en fin/milieu de phrase (test heuristique
      // — on tolère les "!" inclus dans une URL, type "!=" code, etc.).
      expect(text).not.toMatch(/(?<![/\\:])\s*!\s*(?:$|\s)/);
    }
  });
});
