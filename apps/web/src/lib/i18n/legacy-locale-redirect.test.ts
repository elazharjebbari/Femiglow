import { describe, expect, it } from 'vitest';

import { resolveLegacyLocaleRedirect } from './legacy-locale-redirect';

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
