/**
 * Tests du choix des textes du hero selon l'angle (Kit CRO v2 §3).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ResolvedField, ResolvedFields } from '@/lib/db/types';
import { findComponentSeed } from '@/lib/components/registry';

import { KIT_ANGLES } from './angle';
import {
  KIT_HERO_ANGLES_COMPONENT_KEY,
  KIT_HERO_ANGLE_FIELDS,
  kitHeroAngleFieldKey,
  resolveKitHeroAngleCopy,
} from './hero-angle-copy';

const DEFAULTS = {
  kicker: 'Sans vernis · compatible woudou',
  titleCategory: 'Kit de manucure japonaise,',
  titlePromise: 'l’éclat sans vernis',
};

function field(value: unknown, source: ResolvedField['meta']['source'] = 'binding'): ResolvedField {
  return { value, meta: { source, version: source === 'binding' ? 1 : 0, locale: 'fr' } };
}

describe('resolveKitHeroAngleCopy', () => {
  it('sans angle : titre par défaut', () => {
    const fields: ResolvedFields = {
      e_titlePromise: field('le soin du salon, chez vous, sans rendez-vous'),
    };
    expect(resolveKitHeroAngleCopy(fields, null, DEFAULTS)).toEqual(DEFAULTS);
    expect(resolveKitHeroAngleCopy(fields, undefined, DEFAULTS)).toEqual(DEFAULTS);
  });

  it('sans champs (base indisponible) : titre par défaut', () => {
    expect(resolveKitHeroAngleCopy(null, 'e', DEFAULTS)).toEqual(DEFAULTS);
    expect(resolveKitHeroAngleCopy({}, 'e', DEFAULTS)).toEqual(DEFAULTS);
  });

  it('applique les trois champs de l’angle', () => {
    const fields: ResolvedFields = {
      e_kicker: field('Sans rendez-vous'),
      e_titleCategory: field('Kit de manucure japonaise,'),
      e_titlePromise: field('le soin du salon, chez vous, sans rendez-vous'),
      a_titlePromise: field('autre angle'),
    };
    expect(resolveKitHeroAngleCopy(fields, 'e', DEFAULTS)).toEqual({
      kicker: 'Sans rendez-vous',
      titleCategory: 'Kit de manucure japonaise,',
      titlePromise: 'le soin du salon, chez vous, sans rendez-vous',
    });
  });

  it('repli champ par champ : vide, espaces ou non-texte → défaut', () => {
    const fields: ResolvedFields = {
      d_kicker: field('Compatible woudou'),
      d_titleCategory: field('   '),
      d_titlePromise: field(42),
    };
    expect(resolveKitHeroAngleCopy(fields, 'd', DEFAULTS)).toEqual({
      kicker: 'Compatible woudou',
      titleCategory: DEFAULTS.titleCategory,
      titlePromise: DEFAULTS.titlePromise,
    });
  });

  it('retire les espaces autour du texte', () => {
    const fields: ResolvedFields = { b_kicker: field('  Zéro vernis  ') };
    expect(resolveKitHeroAngleCopy(fields, 'b', DEFAULTS).kicker).toBe('Zéro vernis');
  });

  it('AR/EN : ignore les valeurs par défaut du registre (FR)', () => {
    const fields: ResolvedFields = {
      c_kicker: field('Une pause avec le semi-permanent', 'default'),
      c_titlePromise: field('أظافر طبيعية تلمع', 'binding'),
    };
    expect(resolveKitHeroAngleCopy(fields, 'c', DEFAULTS, { acceptDefault: false })).toEqual({
      kicker: DEFAULTS.kicker,
      titleCategory: DEFAULTS.titleCategory,
      titlePromise: 'أظافر طبيعية تلمع',
    });
  });

  it('FR : accepte les valeurs par défaut du registre', () => {
    const fields: ResolvedFields = { c_kicker: field('Une pause', 'default') };
    expect(resolveKitHeroAngleCopy(fields, 'c', DEFAULTS).kicker).toBe('Une pause');
  });
});

describe('composant CMS kit-hero-angles', () => {
  const seed = findComponentSeed(KIT_HERO_ANGLES_COMPONENT_KEY);

  it('est déclaré dans le registre (groupe kit)', () => {
    expect(seed).toBeDefined();
    expect(seed?.pageGroup).toBe('kit');
  });

  it('déclare un champ texte par angle et par ligne, avec une valeur FR', () => {
    const fields = seed?.fields ?? [];
    expect(fields).toHaveLength(KIT_ANGLES.length * KIT_HERO_ANGLE_FIELDS.length);
    const limits = { kicker: 60, titleCategory: 80, titlePromise: 90 } as const;
    for (const angle of KIT_ANGLES) {
      for (const name of KIT_HERO_ANGLE_FIELDS) {
        const def = fields.find((f) => f.key === kitHeroAngleFieldKey(angle, name));
        expect(def, `${angle}_${name}`).toBeDefined();
        expect(def?.type).toBe('text');
        expect(def?.config).toEqual({ maxLength: limits[name] });
        expect(typeof def?.defaultValue).toBe('string');
        expect((def?.defaultValue as string).length).toBeGreaterThan(0);
        expect((def?.defaultValue as string).length).toBeLessThanOrEqual(limits[name]);
        expect(def?.description).toBeTruthy();
      }
    }
  });

  it('les clés de champ sont uniques', () => {
    const keys = (seed?.fields ?? []).map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

/**
 * Le prix dépend du code promo (99 DH avec le code de la publicité, 199 DH
 * sans) : il est affiché par le bouton, jamais figé dans un titre d'angle.
 */
describe('titres d’angle sans prix (angle E « salon ou 99 DH »)', () => {
  const PRICE = /\d|\bDH\b|MAD|درهم/u;

  it('valeurs par défaut du registre : angle E et aucun titre avec un prix', () => {
    const fields = findComponentSeed(KIT_HERO_ANGLES_COMPONENT_KEY)?.fields ?? [];
    const promiseE = fields.find((f) => f.key === kitHeroAngleFieldKey('e', 'titlePromise'));
    expect(promiseE?.defaultValue).toBe('le soin du salon, chez vous, sans rendez-vous');
    for (const def of fields) {
      expect(String(def.defaultValue), def.key).not.toMatch(PRICE);
    }
  });

  it('script de contenu FR/AR : angle E sans prix, longueurs dans les limites', () => {
    const sql = readFileSync(
      path.resolve(__dirname, '../../../scripts/content/2026-10-kit-hero-angles.sql'),
      'utf8',
    );
    const rows = [...sql.matchAll(/\('([a-z]+_[A-Za-z]+)', '(fr|ar)', '([^']*)'\)/gu)].map(
      ([, key, locale, text]) => ({ key: key!, locale: locale!, text: text! }),
    );
    expect(rows.length).toBeGreaterThan(0);
    const find = (key: string, locale: string) =>
      rows.find((r) => r.key === key && r.locale === locale)?.text;
    expect(find('e_titlePromise', 'fr')).toBe('le soin du salon, chez vous, sans rendez-vous');
    expect(find('e_titlePromise', 'ar')).toBe('عناية الصالون في بيتكِ، دون موعد');

    const limits: Record<string, number> = { kicker: 60, titleCategory: 80, titlePromise: 90 };
    for (const row of rows) {
      const name = row.key.split('_')[1]!;
      expect(row.text.length, `${row.key}/${row.locale}`).toBeLessThanOrEqual(limits[name]!);
      if (name === 'titlePromise') {
        expect(row.text, `${row.key}/${row.locale}`).not.toMatch(PRICE);
      }
    }
  });
});
