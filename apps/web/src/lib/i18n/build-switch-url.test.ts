/**
 * Lot L1 — tests du helper pur `buildSwitchUrl` / `deriveLocale`.
 * Couvre INV-4 (préservation querystring/UTM) et les cas d'URL du plan.
 * @see docs/locale-switcher-v2/08-plan-action/plan-action.md (L1)
 */
import { describe, expect, it } from 'vitest';

import { buildSwitchUrl, deriveLocale } from './build-switch-url';

describe('deriveLocale', () => {
  it.each([
    ['/ar/kit', 'ar'],
    ['/fr/kit', 'fr'],
    ['/en/journal/post-1', 'en'],
    ['/ar', 'ar'],
    ['/kit', 'fr'], // pas de préfixe → défaut
    ['/', 'fr'], // racine nue → défaut
    ['', 'fr'], // vide → défaut
    ['/x/kit', 'fr'], // segment non-locale → défaut
  ])('dérive %s → %s', (pathname, expected) => {
    expect(deriveLocale(pathname)).toBe(expected);
  });
});

describe('buildSwitchUrl — insertion / remplacement du préfixe', () => {
  it('insère le préfixe quand absent (/kit → /ar/kit)', () => {
    expect(buildSwitchUrl('/kit', '', 'ar')).toBe('/ar/kit');
  });
  it('remplace le préfixe existant (/fr/kit → /ar/kit)', () => {
    expect(buildSwitchUrl('/fr/kit', '', 'ar')).toBe('/ar/kit');
  });
  it('gère la racine localisée (/fr → /ar)', () => {
    expect(buildSwitchUrl('/fr', '', 'ar')).toBe('/ar');
  });
  it('gère la racine nue (/ → /ar)', () => {
    expect(buildSwitchUrl('/', '', 'ar')).toBe('/ar');
  });
  it('gère les chemins profonds (/fr/journal/post-1 → /en/journal/post-1)', () => {
    expect(buildSwitchUrl('/fr/journal/post-1', '', 'en')).toBe(
      '/en/journal/post-1',
    );
  });
  it('gère un slash de fin (/fr/kit/ → /ar/kit)', () => {
    expect(buildSwitchUrl('/fr/kit/', '', 'ar')).toBe('/ar/kit');
  });
});

describe('buildSwitchUrl — préservation du querystring (INV-4)', () => {
  it('préserve un UTM simple', () => {
    expect(buildSwitchUrl('/fr/kit', 'utm_source=ig', 'ar')).toBe(
      '/ar/kit?utm_source=ig',
    );
  });
  it('préserve plusieurs paramètres', () => {
    expect(buildSwitchUrl('/fr/kit', 'utm_source=ig&x=1', 'ar')).toBe(
      '/ar/kit?utm_source=ig&x=1',
    );
  });
  it('accepte un querystring déjà préfixé par ?', () => {
    expect(buildSwitchUrl('/fr/kit', '?utm_source=ig', 'ar')).toBe(
      '/ar/kit?utm_source=ig',
    );
  });
  it('ignore un querystring vide / nul / espaces', () => {
    expect(buildSwitchUrl('/fr/kit', '', 'ar')).toBe('/ar/kit');
    expect(buildSwitchUrl('/fr/kit', null, 'ar')).toBe('/ar/kit');
    expect(buildSwitchUrl('/fr/kit', undefined, 'ar')).toBe('/ar/kit');
    expect(buildSwitchUrl('/fr/kit', '   ', 'ar')).toBe('/ar/kit');
  });
  it('préserve le querystring sur insertion (/kit?utm=x → /ar/kit?utm=x)', () => {
    expect(buildSwitchUrl('/kit', 'utm=x', 'ar')).toBe('/ar/kit?utm=x');
  });
});
