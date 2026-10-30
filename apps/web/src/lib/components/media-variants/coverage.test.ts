/**
 * Tests unitaires — `computeMediaSetCoverage` (matrice admin, pur).
 *
 * Vérifie que la couverture réutilise la chaîne de repli de
 * `selectMediaSet` : cellule exacte, héritage (`*`, `crossLocale`, défaut),
 * délégation (niveau 7), dimensions A/B ignorées.
 */
import { describe, expect, it } from 'vitest';
import { KIT_ANGLES } from '@/lib/kit/angle';
import { LOCALES } from '@/i18n.config';
import { computeMediaSetCoverage } from './coverage';
import { AB_POLICY, KIT_POLICY, makeSet } from './__fixtures__/sets';

const cell = (
  coverage: ReturnType<typeof computeMediaSetCoverage>,
  q: { slot?: string; variantDim?: string; variantKey: string; locale: string },
) =>
  coverage.cells.find(
    (c) =>
      c.slot === (q.slot ?? 'primary') &&
      c.variantDim === (q.variantDim ?? (q.variantKey === '*' ? 'default' : 'angle')) &&
      c.variantKey === q.variantKey &&
      c.locale === q.locale,
  )!;

describe('computeMediaSetCoverage', () => {
  it('sans ensemble : toutes les cellules sont déléguées (niveau 7)', () => {
    const coverage = computeMediaSetCoverage([], KIT_POLICY);
    const total = (1 + KIT_ANGLES.length) * LOCALES.length * KIT_POLICY.slots.length;
    expect(coverage.summary).toEqual({ total, exact: 0, inherited: 0, delegated: total });
    expect(coverage.cells.every((c) => c.level === 7 && c.setId === null)).toBe(true);
    expect(coverage.skippedDimensions).toEqual([]);
  });

  it('cellule exacte, héritage `*` et défaut, sans mélange de slots', () => {
    const sets = [
      makeSet({ id: 'def', dim: 'default', key: '*', locale: '*' }),
      makeSet({ id: 'e_ar', dim: 'angle', key: 'e', locale: 'ar' }),
      makeSet({ id: 'e_any', dim: 'angle', key: 'e', locale: '*', version: 3 }),
      makeSet({ id: 'sec_fr', slot: 'secondary', dim: 'default', key: '*', locale: 'fr', count: 9 }),
    ];
    const coverage = computeMediaSetCoverage(sets, KIT_POLICY);

    expect(cell(coverage, { variantKey: 'e', locale: 'ar' })).toMatchObject({
      level: 1,
      exact: true,
      sameLocale: true,
      setId: 'e_ar',
    });
    // Ensemble `e/*` : propre à la ligne e (exact), mais pas de la langue.
    expect(cell(coverage, { variantKey: 'e', locale: 'en' })).toMatchObject({
      level: 2,
      exact: true,
      sameLocale: false,
      setId: 'e_any',
      source: { variantDim: 'angle', variantKey: 'e', locale: '*', version: 3 },
    });
    // Angle a sans ensemble : hérite du défaut (inherited).
    expect(cell(coverage, { variantKey: 'a', locale: 'fr' })).toMatchObject({ level: 5, exact: false, setId: 'def' });
    // Ligne défaut servie par le défaut `*` : exacte (même dimension), autre langue.
    expect(cell(coverage, { variantKey: '*', locale: 'fr' })).toMatchObject({
      level: 5,
      exact: true,
      sameLocale: false,
    });
    // secondary : défaut fr exact pour la ligne défaut ; plafonné à maxItems (6).
    expect(cell(coverage, { slot: 'secondary', variantKey: '*', locale: 'fr' })).toMatchObject({
      level: 4,
      exact: true,
      itemCount: 6,
    });
    // secondary en ar : `fr` non crossLocale → délégué.
    expect(cell(coverage, { slot: 'secondary', variantKey: '*', locale: 'ar' }).level).toBe(7);
    const { total, exact, inherited, delegated } = coverage.summary;
    expect(exact + inherited + delegated).toBe(total);
    // primary : ligne défaut (3 langues) + e (3 langues) exactes ; les 5
    // autres angles × 3 langues héritent du défaut. secondary : ligne
    // défaut fr exacte, angles × fr hérités, le reste délégué.
    const primary = coverage.cells.filter((c) => c.slot === 'primary');
    expect(primary.filter((c) => c.exact)).toHaveLength(6);
    expect(primary.filter((c) => !c.exact && c.level !== 7)).toHaveLength((KIT_ANGLES.length - 1) * LOCALES.length);
  });

  it('crossLocale : la cellule ar hérite de l’ensemble fr sans texte (niveau 3)', () => {
    const coverage = computeMediaSetCoverage(
      [makeSet({ id: 'c_fr', dim: 'angle', key: 'c', locale: 'fr', crossLocale: true })],
      KIT_POLICY,
    );
    expect(cell(coverage, { variantKey: 'c', locale: 'ar' })).toMatchObject({
      level: 3,
      exact: true,
      sameLocale: false,
      setId: 'c_fr',
    });
  });

  it('un ensemble dont tous les médias sont supprimés ne couvre rien', () => {
    const coverage = computeMediaSetCoverage(
      [makeSet({ id: 'dead', dim: 'angle', key: 'b', locale: 'fr', items: [{ media: null }] })],
      KIT_POLICY,
    );
    expect(cell(coverage, { variantKey: 'b', locale: 'fr' }).level).toBe(7);
  });

  it('les dimensions A/B (valeurs dynamiques) sont signalées et ignorées', () => {
    const coverage = computeMediaSetCoverage([makeSet()], AB_POLICY);
    expect(coverage.skippedDimensions).toEqual(['ab:hero-media-2026-11']);
    expect(coverage.cells.some((c) => c.variantDim.startsWith('ab:'))).toBe(false);
  });
});
