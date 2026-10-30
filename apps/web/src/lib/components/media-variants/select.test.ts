/**
 * Tests — `selectMediaSet` : chaîne de repli §4.3 (fonction pure).
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.3 et §5
 */
import { describe, expect, it } from 'vitest';
import { fallbackCandidates, selectMediaSet } from './select';
import { AB_POLICY, KIT_POLICY, makeMedia, makeSet } from './__fixtures__/sets';
import type { AudienceContext } from './types';

const AR_E: AudienceContext = { locale: 'ar', variants: { angle: 'e' } };

/** Jeu complet : un ensemble par niveau 1 à 6 pour (angle e, ar). */
function fullLadder() {
  return {
    l1: makeSet({ id: 'l1', dim: 'angle', key: 'e', locale: 'ar' }),
    l2: makeSet({ id: 'l2', dim: 'angle', key: 'e', locale: '*' }),
    l3: makeSet({ id: 'l3', dim: 'angle', key: 'e', locale: 'fr', crossLocale: true }),
    l4: makeSet({ id: 'l4', dim: 'default', key: '*', locale: 'ar' }),
    l5: makeSet({ id: 'l5', dim: 'default', key: '*', locale: '*' }),
    l6: makeSet({ id: 'l6', dim: 'default', key: '*', locale: 'fr', crossLocale: true }),
  };
}

describe('selectMediaSet — table des niveaux de repli', () => {
  const ladder = fullLadder();
  const order = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'] as const;

  it.each(order.map((id, i) => [id, i + 1] as const))(
    'retient %s (niveau %i) quand les niveaux supérieurs manquent',
    (id, level) => {
      const sets = order.slice(level - 1).map((k) => ladder[k]);
      const sel = selectMediaSet(sets, 'primary', AR_E, KIT_POLICY);
      expect(sel?.set.id).toBe(id);
      expect(sel?.level).toBe(level);
    },
  );

  it('niveaux 7–8 : aucun ensemble → null (l’appelant fait legacy puis produit)', () => {
    expect(selectMediaSet([], 'primary', AR_E, KIT_POLICY)).toBeNull();
  });

  it('niveaux 7–8 : seulement des ensembles d’autres angles / langues non cross → null', () => {
    const sets = [
      makeSet({ dim: 'angle', key: 'a', locale: 'ar' }),
      makeSet({ dim: 'angle', key: 'e', locale: 'en' }),
      makeSet({ dim: 'default', locale: 'en' }),
      makeSet({ dim: 'default', locale: 'fr', crossLocale: false }),
    ];
    expect(selectMediaSet(sets, 'primary', AR_E, KIT_POLICY)).toBeNull();
  });

  it('slot absent de la politique → null', () => {
    const sets = [makeSet({ slot: 'banner' })];
    expect(selectMediaSet(sets, 'banner', AR_E, KIT_POLICY)).toBeNull();
  });

  it('ignore les ensembles d’un autre slot', () => {
    const sets = [makeSet({ id: 'sec', slot: 'secondary', dim: 'angle', key: 'e', locale: 'ar' })];
    expect(selectMediaSet(sets, 'primary', AR_E, KIT_POLICY)).toBeNull();
    expect(selectMediaSet(sets, 'secondary', AR_E, KIT_POLICY)?.set.id).toBe('sec');
  });
});

describe('selectMediaSet — crossLocale', () => {
  it('variante en fr NON crossLocale n’est pas servie en ar (texte FR incrusté)', () => {
    const sets = [
      makeSet({ id: 'fr-text', dim: 'angle', key: 'e', locale: 'fr', crossLocale: false }),
      makeSet({ id: 'def', dim: 'default', locale: '*' }),
    ];
    const sel = selectMediaSet(sets, 'primary', AR_E, KIT_POLICY);
    expect(sel?.set.id).toBe('def');
    expect(sel?.level).toBe(5);
  });

  it('variante en fr crossLocale est servie en ar et en en (niveau 3)', () => {
    const sets = [makeSet({ id: 'fr-x', dim: 'angle', key: 'e', locale: 'fr', crossLocale: true })];
    expect(selectMediaSet(sets, 'primary', AR_E, KIT_POLICY)?.level).toBe(3);
    expect(
      selectMediaSet(sets, 'primary', { locale: 'en', variants: { angle: 'e' } }, KIT_POLICY)?.level,
    ).toBe(3);
  });

  it('en fr, un ensemble fr est toujours un niveau 1 (crossLocale indifférent)', () => {
    const sets = [makeSet({ id: 'fr', dim: 'angle', key: 'e', locale: 'fr', crossLocale: false })];
    const sel = selectMediaSet(sets, 'primary', { locale: 'fr', variants: { angle: 'e' } }, KIT_POLICY);
    expect(sel?.level).toBe(1);
  });

  it('défaut fr crossLocale=false ignoré en en ; true → niveau 6', () => {
    const ctx: AudienceContext = { locale: 'en', variants: {} };
    expect(
      selectMediaSet([makeSet({ dim: 'default', locale: 'fr' })], 'primary', ctx, KIT_POLICY),
    ).toBeNull();
    expect(
      selectMediaSet([makeSet({ dim: 'default', locale: 'fr', crossLocale: true })], 'primary', ctx, KIT_POLICY)
        ?.level,
    ).toBe(6);
  });

  it('un ensemble ar crossLocale ne sert pas en en (seul fr est la langue source)', () => {
    const sets = [makeSet({ dim: 'angle', key: 'e', locale: 'ar', crossLocale: true })];
    expect(
      selectMediaSet(sets, 'primary', { locale: 'en', variants: { angle: 'e' } }, KIT_POLICY),
    ).toBeNull();
  });
});

describe('selectMediaSet — dimensions', () => {
  it('sans angle (null) → saute directement aux niveaux défaut', () => {
    const sets = [
      makeSet({ id: 'ang', dim: 'angle', key: 'e', locale: '*' }),
      makeSet({ id: 'def', dim: 'default', locale: 'ar' }),
    ];
    const sel = selectMediaSet(sets, 'primary', { locale: 'ar', variants: { angle: null } }, KIT_POLICY);
    expect(sel?.set.id).toBe('def');
    expect(sel?.level).toBe(4);
  });

  it('une clé `*` dans le contexte est ignorée (jamais une vraie variante)', () => {
    const sets = [makeSet({ id: 'def', dim: 'default', locale: '*' })];
    const sel = selectMediaSet(sets, 'primary', { locale: 'fr', variants: { angle: '*' } }, KIT_POLICY);
    expect(sel?.level).toBe(5);
  });

  it('dimension non déclarée dans la politique : ignorée même si le contexte la porte', () => {
    const sets = [
      makeSet({ id: 'ab', dim: 'ab:hero-media-2026-11', key: 'b', locale: '*' }),
      makeSet({ id: 'def', dim: 'default', locale: '*' }),
    ];
    const ctx: AudienceContext = { locale: 'fr', variants: { 'ab:hero-media-2026-11': 'b' } };
    expect(selectMediaSet(sets, 'primary', ctx, KIT_POLICY)?.set.id).toBe('def');
  });

  it('priorité : `ab:` déclarée avant `angle` gagne, même à un niveau de langue moins précis', () => {
    const sets = [
      makeSet({ id: 'ab-any', dim: 'ab:hero-media-2026-11', key: 'b', locale: '*' }),
      makeSet({ id: 'angle-ar', dim: 'angle', key: 'e', locale: 'ar' }),
    ];
    const ctx: AudienceContext = {
      locale: 'ar',
      variants: { 'ab:hero-media-2026-11': 'b', angle: 'e' },
    };
    const sel = selectMediaSet(sets, 'primary', ctx, AB_POLICY);
    expect(sel?.set.id).toBe('ab-any');
    expect(sel?.level).toBe(2);
  });

  it('priorité : sans ensemble pour le bras A/B, on retombe sur l’angle', () => {
    const sets = [
      makeSet({ id: 'ab-other-arm', dim: 'ab:hero-media-2026-11', key: 'a', locale: '*' }),
      makeSet({ id: 'angle-ar', dim: 'angle', key: 'e', locale: 'ar' }),
    ];
    const ctx: AudienceContext = {
      locale: 'ar',
      variants: { 'ab:hero-media-2026-11': 'b', angle: 'e' },
    };
    const sel = selectMediaSet(sets, 'primary', ctx, AB_POLICY);
    expect(sel?.set.id).toBe('angle-ar');
    expect(sel?.level).toBe(1);
  });

  it('fallbackCandidates : ordre ab (1-3) → angle (1-3) → défaut (4-6)', () => {
    const c = fallbackCandidates(AB_POLICY, {
      locale: 'ar',
      variants: { 'ab:hero-media-2026-11': 'b', angle: 'e' },
    });
    expect(c.map((x) => `${x.dim}/${x.key}/${x.locale}/${x.level}`)).toEqual([
      'ab:hero-media-2026-11/b/ar/1',
      'ab:hero-media-2026-11/b/*/2',
      'ab:hero-media-2026-11/b/fr/3',
      'angle/e/ar/1',
      'angle/e/*/2',
      'angle/e/fr/3',
      'default/*/ar/4',
      'default/*/*/5',
      'default/*/fr/6',
    ]);
  });
});

describe('selectMediaSet — ensembles vides, médias supprimés, jamais de mélange', () => {
  it('ensemble sans item → niveau suivant', () => {
    const sets = [
      makeSet({ id: 'empty', dim: 'angle', key: 'e', locale: 'ar', items: [] }),
      makeSet({ id: 'next', dim: 'angle', key: 'e', locale: '*' }),
    ];
    expect(selectMediaSet(sets, 'primary', AR_E, KIT_POLICY)?.set.id).toBe('next');
  });

  it('média supprimé / pas prêt (media=null) → niveau suivant', () => {
    const sets = [
      makeSet({ id: 'deleted', dim: 'angle', key: 'e', locale: 'ar', items: [{ media: null }] }),
      makeSet({ id: 'def', dim: 'default', locale: '*' }),
    ];
    const sel = selectMediaSet(sets, 'primary', AR_E, KIT_POLICY);
    expect(sel?.set.id).toBe('def');
    expect(sel?.level).toBe(5);
  });

  it('média sans variant ni original (aucune URL) → niveau suivant', () => {
    const noUrl = makeMedia('m_nourl', { variants: [], originalUrl: null });
    const sets = [
      makeSet({ id: 'nourl', dim: 'angle', key: 'e', locale: 'ar', items: [{ media: noUrl }] }),
      makeSet({ id: 'def', dim: 'default', locale: '*' }),
    ];
    expect(selectMediaSet(sets, 'primary', AR_E, KIT_POLICY)?.set.id).toBe('def');
  });

  it('liste partiellement supprimée : garde les items restants du MÊME ensemble, sans compléter', () => {
    const sets = [
      makeSet({
        id: 'partial',
        slot: 'secondary',
        dim: 'angle',
        key: 'e',
        locale: 'ar',
        items: [{}, { media: null }, {}],
      }),
      makeSet({ id: 'def', slot: 'secondary', dim: 'default', locale: '*', count: 6 }),
    ];
    const sel = selectMediaSet(sets, 'secondary', AR_E, KIT_POLICY);
    expect(sel?.set.id).toBe('partial');
    expect(sel?.items.map((i) => i.position)).toEqual([0, 2]);
    expect(sel?.items.every((i) => i.setId === 'partial')).toBe(true);
  });

  it('trie par position et plafonne à maxItems (6) pour une liste', () => {
    const set = makeSet({ id: 'big', slot: 'secondary', count: 8 });
    set.items.reverse();
    const sel = selectMediaSet([set], 'secondary', AR_E, KIT_POLICY);
    expect(sel?.items.map((i) => i.position)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('slot single : une seule image même si l’ensemble en contient plusieurs', () => {
    const sel = selectMediaSet([makeSet({ count: 3 })], 'primary', AR_E, KIT_POLICY);
    expect(sel?.items).toHaveLength(1);
    expect(sel?.items[0]?.position).toBe(0);
  });
});
