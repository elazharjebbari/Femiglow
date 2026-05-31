/**
 * Garde-fou de parité des catalogues i18n (PHASE-8 §8C.3).
 *
 * Invariant : les trois locales `fr`/`ar`/`en` exposent **exactement le même
 * ensemble de clés visibles**. Une clé ajoutée dans une seule locale (oubli de
 * traduction) fait échouer ce test → pas de fallback silencieux vers la clé brute.
 *
 * Le namespace `_meta.*` est **exclu** : ce sont des métadonnées du process de
 * traduction (inventaire source, normalisations, `direction`, `translator_notes`),
 * volontairement divergentes d'une locale à l'autre — pas du contenu affiché.
 *
 * Couvre aussi le dictionnaire du wizard checkout (`fr`/`ar`/`en`), dont la
 * parité de shape est exigée par l'architecture (CHA-232).
 */
import { describe, expect, it } from 'vitest';

import fr from '../../messages/fr.json';
import ar from '../../messages/ar.json';
import en from '../../messages/en.json';
import { getWizardDictionary } from '@/lib/checkout/i18n/dictionary';

/** Collecte récursive des chemins de feuilles (`a.b.c`) d'un objet imbriqué. */
function leafPaths(
  value: unknown,
  prefix = '',
  acc: Set<string> = new Set(),
): Set<string> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      leafPaths(child, path, acc);
    }
  } else {
    acc.add(prefix);
  }
  return acc;
}

/** Clés visibles d'un catalogue messages (hors namespace `_meta`). */
function visibleKeys(catalog: unknown): Set<string> {
  return new Set(
    [...leafPaths(catalog)].filter((k) => !k.startsWith('_meta')),
  );
}

/** Diff symétrique entre deux ensembles (clés présentes d'un seul côté). */
function symmetricDiff(a: Set<string>, b: Set<string>): string[] {
  const onlyA = [...a].filter((k) => !b.has(k)).map((k) => `fr-only: ${k}`);
  const onlyB = [...b].filter((k) => !a.has(k)).map((k) => `other-only: ${k}`);
  return [...onlyA, ...onlyB].sort();
}

describe('parité des catalogues messages (fr/ar/en)', () => {
  const keysFr = visibleKeys(fr);
  const keysAr = visibleKeys(ar);
  const keysEn = visibleKeys(en);

  it('fr et ar ont le même ensemble de clés visibles', () => {
    expect(symmetricDiff(keysFr, keysAr)).toEqual([]);
  });

  it('fr et en ont le même ensemble de clés visibles', () => {
    expect(symmetricDiff(keysFr, keysEn)).toEqual([]);
  });

  it('les trois locales ont le même nombre de clés visibles', () => {
    expect(keysAr.size).toBe(keysFr.size);
    expect(keysEn.size).toBe(keysFr.size);
  });

  it('aucune valeur traduite vide dans ar/en', () => {
    const flat = (cat: unknown) => {
      const m: Record<string, unknown> = {};
      const walk = (v: unknown, p: string) => {
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          for (const [k, c] of Object.entries(v)) walk(c, p ? `${p}.${k}` : k);
        } else m[p] = v;
      };
      walk(cat, '');
      return m;
    };
    const flatAr = flat(ar);
    const flatEn = flat(en);
    const empties: string[] = [];
    for (const k of keysFr) {
      if (flatAr[k] === '') empties.push(`ar: ${k}`);
      if (flatEn[k] === '') empties.push(`en: ${k}`);
    }
    expect(empties).toEqual([]);
  });
});

describe('parité du dictionnaire wizard checkout (fr/ar/en)', () => {
  const shapeFr = leafPaths(getWizardDictionary('fr'));
  const shapeAr = leafPaths(getWizardDictionary('ar'));
  const shapeEn = leafPaths(getWizardDictionary('en'));

  it('fr et ar ont le même shape', () => {
    expect(symmetricDiff(shapeFr, shapeAr)).toEqual([]);
  });

  it('fr et en ont le même shape', () => {
    expect(symmetricDiff(shapeFr, shapeEn)).toEqual([]);
  });
});
