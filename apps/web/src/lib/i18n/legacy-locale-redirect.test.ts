import { describe, expect, it } from 'vitest';

import {
  resolveLegacyLocaleRedirect,
  resolveLegacyLocaleRouting,
} from './legacy-locale-redirect';

describe('resolveLegacyLocaleRedirect', () => {
  it('redirige la racine vers la locale par défaut', () => {
    expect(resolveLegacyLocaleRedirect('/')).toBe('/fr');
  });

  it('redirige les racines mirrorées (kit, maison, contact, journal, rituel)', () => {
    expect(resolveLegacyLocaleRedirect('/kit')).toBe('/fr/kit');
    expect(resolveLegacyLocaleRedirect('/maison')).toBe('/fr/maison');
    expect(resolveLegacyLocaleRedirect('/journal/mon-article')).toBe(
      '/fr/journal/mon-article',
    );
  });

  it('honore le cookie NEXT_LOCALE valide', () => {
    expect(resolveLegacyLocaleRedirect('/', 'ar')).toBe('/ar');
    expect(resolveLegacyLocaleRedirect('/kit', 'en')).toBe('/en/kit');
  });

  it('ignore un cookie invalide → locale par défaut', () => {
    expect(resolveLegacyLocaleRedirect('/kit', 'de')).toBe('/fr/kit');
    expect(resolveLegacyLocaleRedirect('/kit', '')).toBe('/fr/kit');
  });

  it('ne redirige pas un chemin déjà localisé', () => {
    expect(resolveLegacyLocaleRedirect('/fr')).toBeNull();
    expect(resolveLegacyLocaleRedirect('/ar/kit')).toBeNull();
    expect(resolveLegacyLocaleRedirect('/en/journal/x')).toBeNull();
  });

  it('ne redirige pas les routes sans miroir localisé', () => {
    expect(resolveLegacyLocaleRedirect('/merci')).toBeNull();
    expect(resolveLegacyLocaleRedirect('/panier')).toBeNull();
    expect(resolveLegacyLocaleRedirect('/mentions-legales')).toBeNull();
    expect(resolveLegacyLocaleRedirect('/commander')).toBeNull();
    expect(resolveLegacyLocaleRedirect('/legal/cgv')).toBeNull();
    expect(resolveLegacyLocaleRedirect('/admin')).toBeNull();
    expect(resolveLegacyLocaleRedirect('/api/checkout/order')).toBeNull();
  });

  it('ne confond pas un préfixe partiel (ex. /kitchen)', () => {
    expect(resolveLegacyLocaleRedirect('/kitchen')).toBeNull();
  });
});

describe('resolveLegacyLocaleRouting', () => {
  const ON = { kitRootRewrite: true };
  const OFF = { kitRootRewrite: false };

  it('rewrite interne de /kit vers /fr/kit quand le flag est actif', () => {
    expect(resolveLegacyLocaleRouting('/kit', undefined, ON)).toEqual({
      kind: 'rewrite',
      pathname: '/fr/kit',
      locale: 'fr',
    });
  });

  it('cookie NEXT_LOCALE=fr explicite → rewrite également', () => {
    expect(resolveLegacyLocaleRouting('/kit', 'fr', ON)?.kind).toBe('rewrite');
  });

  it('cookie invalide → locale par défaut, donc rewrite', () => {
    expect(resolveLegacyLocaleRouting('/kit', 'de', ON)).toEqual({
      kind: 'rewrite',
      pathname: '/fr/kit',
      locale: 'fr',
    });
  });

  it('cookie ar/en → 307 conservé (locale dérivée du pathname côté client)', () => {
    expect(resolveLegacyLocaleRouting('/kit', 'ar', ON)).toEqual({
      kind: 'redirect',
      pathname: '/ar/kit',
      locale: 'ar',
    });
    expect(resolveLegacyLocaleRouting('/kit', 'en', ON)?.kind).toBe('redirect');
  });

  it('flag désactivé → 307 historique sur /kit', () => {
    expect(resolveLegacyLocaleRouting('/kit', undefined, OFF)).toEqual({
      kind: 'redirect',
      pathname: '/fr/kit',
      locale: 'fr',
    });
  });

  it('ne rewrite que /kit exact : /, /kit/…, autres racines → redirect', () => {
    expect(resolveLegacyLocaleRouting('/', undefined, ON)?.kind).toBe('redirect');
    expect(resolveLegacyLocaleRouting('/kit/', undefined, ON)?.kind).toBe('redirect');
    expect(resolveLegacyLocaleRouting('/kit/details', undefined, ON)?.kind).toBe('redirect');
    expect(resolveLegacyLocaleRouting('/maison', undefined, ON)?.kind).toBe('redirect');
    expect(resolveLegacyLocaleRouting('/journal/x', undefined, ON)?.kind).toBe('redirect');
  });

  it('aucune décision pour un chemin déjà localisé ou sans miroir', () => {
    expect(resolveLegacyLocaleRouting('/fr/kit', undefined, ON)).toBeNull();
    expect(resolveLegacyLocaleRouting('/ar/kit', 'ar', ON)).toBeNull();
    expect(resolveLegacyLocaleRouting('/kitchen', undefined, ON)).toBeNull();
    expect(resolveLegacyLocaleRouting('/merci', undefined, ON)).toBeNull();
  });
});
