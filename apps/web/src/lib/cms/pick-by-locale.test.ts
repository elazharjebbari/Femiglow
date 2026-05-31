/**
 * Tests pour `pickByLocale` — sélection locale avec fallback chain.
 */
import { describe, expect, it } from 'vitest';

import { LocaleContentMissingError, pickByLocale, pickByLocaleOrNull } from './pick-by-locale';

describe('pickByLocale', () => {
  it('retourne le contenu direct si la locale existe', () => {
    const result = pickByLocale(
      { fr: 'bonjour', ar: 'مرحبا', en: 'hello' },
      { locale: 'ar' },
    );
    expect(result).toBe('مرحبا');
  });

  it('fallback FR si la locale demandée manque (défaut)', () => {
    const result = pickByLocale({ fr: 'bonjour' }, { locale: 'ar' });
    expect(result).toBe('bonjour');
  });

  it('fallback custom si configuré', () => {
    const result = pickByLocale(
      { en: 'hello' },
      { locale: 'ar', fallback: 'en' },
    );
    expect(result).toBe('hello');
  });

  it('throw LocaleContentMissingError si rien trouvé et fallback=null', () => {
    expect(() =>
      pickByLocale<string>({}, { locale: 'ar', fallback: null }),
    ).toThrow(LocaleContentMissingError);
  });

  it('throw aussi si fallback configuré mais aussi absent', () => {
    expect(() =>
      pickByLocale<string>({}, { locale: 'ar', fallback: 'en' }),
    ).toThrow(LocaleContentMissingError);
  });

  it('retourne la locale par défaut (fr) si pas de options', () => {
    const result = pickByLocale({ fr: 'bonjour', ar: 'مرحبا' });
    expect(result).toBe('bonjour');
  });

  it('LocaleContentMissingError expose attemptedLocale et fallbackTried', () => {
    try {
      pickByLocale<string>({}, { locale: 'ar', fallback: 'en' });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(LocaleContentMissingError);
      if (err instanceof LocaleContentMissingError) {
        expect(err.attemptedLocale).toBe('ar');
        expect(err.fallbackTried).toBe('en');
      }
    }
  });

  it('respecte fallback=null (pas de fallback automatique)', () => {
    expect(() =>
      pickByLocale<string>(
        { en: 'hello' },
        { locale: 'ar', fallback: null },
      ),
    ).toThrow(LocaleContentMissingError);
  });

  it('marche avec des objets complexes (TS générique)', () => {
    interface Section {
      title: string;
      cta: { label: string; href: string };
    }
    const data: Partial<Record<'fr' | 'ar' | 'en', Section>> = {
      fr: { title: 'Accueil', cta: { label: 'Découvrir', href: '/kit' } },
      ar: { title: 'الرئيسية', cta: { label: 'اكتشفي', href: '/kit' } },
    };
    const result = pickByLocale(data, { locale: 'ar' });
    expect(result.title).toBe('الرئيسية');
    expect(result.cta.label).toBe('اكتشفي');
  });
});

describe('pickByLocaleOrNull', () => {
  it('retourne le contenu si trouvé', () => {
    const result = pickByLocaleOrNull(
      { fr: 'bonjour' },
      { locale: 'fr' },
    );
    expect(result).toBe('bonjour');
  });

  it('retourne null au lieu de throw', () => {
    const result = pickByLocaleOrNull<string>(
      {},
      { locale: 'ar', fallback: null },
    );
    expect(result).toBeNull();
  });

  it('throw quand même pour les non-LocaleContentMissingError', () => {
    // Edge case : si byLocale est mal typé et throws différemment
    const data = new Proxy(
      {},
      {
        get() {
          throw new Error('Some other error');
        },
      },
    );
    expect(() =>
      pickByLocaleOrNull<string>(data as Partial<Record<'fr', string>>, {
        locale: 'fr',
      }),
    ).toThrow('Some other error');
  });
});
