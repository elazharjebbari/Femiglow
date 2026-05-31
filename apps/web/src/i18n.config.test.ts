/**
 * Tests unitaires pour `i18n.config.ts` — la source unique des locales.
 *
 * Couverture :
 *  - Constantes (LOCALES, DEFAULT_LOCALE) cohérentes
 *  - Type guards (isLocale, coerceLocale)
 *  - Configuration détaillée par locale (LOCALES_CONFIG)
 *  - Helpers (getLocaleConfig, getEnabledLocales)
 */
import { describe, expect, it } from 'vitest';

import {
  coerceLocale,
  DEFAULT_LOCALE,
  getEnabledLocales,
  getLocaleConfig,
  isLocale,
  LOCALES,
  LOCALES_CONFIG,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  LOCALE_PREFIX_STRATEGY,
} from './i18n.config';

describe('i18n.config — constantes', () => {
  it('LOCALES contient fr, ar, en exactement', () => {
    expect(LOCALES).toEqual(['fr', 'ar', 'en']);
  });

  it('DEFAULT_LOCALE est dans LOCALES', () => {
    expect(LOCALES).toContain(DEFAULT_LOCALE);
  });

  it('DEFAULT_LOCALE est fr (cf. ADR-003)', () => {
    expect(DEFAULT_LOCALE).toBe('fr');
  });

  it('LOCALE_COOKIE_NAME est NEXT_LOCALE (standard next-intl)', () => {
    expect(LOCALE_COOKIE_NAME).toBe('NEXT_LOCALE');
  });

  it('LOCALE_COOKIE_MAX_AGE est 1 an en secondes', () => {
    expect(LOCALE_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 365);
  });

  it('LOCALE_PREFIX_STRATEGY est always (cf. ADR-002)', () => {
    expect(LOCALE_PREFIX_STRATEGY).toBe('always');
  });
});

describe('i18n.config — isLocale (type guard)', () => {
  it.each(['fr', 'ar', 'en'])('reconnaît la locale supportée "%s"', (loc) => {
    expect(isLocale(loc)).toBe(true);
  });

  it.each(['FR', 'AR', 'EN', 'fr-FR', 'es', 'zh', '', 'fr ', ' fr'])(
    'rejette "%s" (locale non supportée ou casse)',
    (loc) => {
      expect(isLocale(loc)).toBe(false);
    },
  );

  it.each([null, undefined, 0, false, [], {}, NaN])(
    'rejette les types non-string : %s',
    (val) => {
      expect(isLocale(val)).toBe(false);
    },
  );
});

describe('i18n.config — coerceLocale (fail-soft)', () => {
  it.each(['fr', 'ar', 'en'])('passe la locale valide "%s" telle quelle', (loc) => {
    expect(coerceLocale(loc)).toBe(loc);
  });

  it.each(['', 'invalid', 'FR', null, undefined, 42])(
    'fallback sur DEFAULT_LOCALE pour valeur invalide : %s',
    (val) => {
      expect(coerceLocale(val)).toBe(DEFAULT_LOCALE);
    },
  );
});

describe('i18n.config — LOCALES_CONFIG', () => {
  it('contient une entrée par locale', () => {
    LOCALES.forEach((loc) => {
      expect(LOCALES_CONFIG[loc]).toBeDefined();
    });
  });

  it('fr est LTR avec fallback null (locale racine)', () => {
    expect(LOCALES_CONFIG.fr.direction).toBe('ltr');
    expect(LOCALES_CONFIG.fr.fallbackLocale).toBeNull();
  });

  it('ar est RTL avec fallback fr', () => {
    expect(LOCALES_CONFIG.ar.direction).toBe('rtl');
    expect(LOCALES_CONFIG.ar.fallbackLocale).toBe('fr');
  });

  it('en est LTR avec fallback fr', () => {
    expect(LOCALES_CONFIG.en.direction).toBe('ltr');
    expect(LOCALES_CONFIG.en.fallbackLocale).toBe('fr');
  });

  it('toutes les locales utilisent MAD comme devise (marché Maroc)', () => {
    LOCALES.forEach((loc) => {
      expect(LOCALES_CONFIG[loc].currencyCode).toBe('MAD');
    });
  });

  it('toutes les locales ont un intlLocale BCP-47 (xx-XX)', () => {
    LOCALES.forEach((loc) => {
      expect(LOCALES_CONFIG[loc].intlLocale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    });
  });

  it('toutes les locales ont un displayNameNative non vide', () => {
    LOCALES.forEach((loc) => {
      expect(LOCALES_CONFIG[loc].displayNameNative.length).toBeGreaterThan(0);
    });
  });

  it('endonyme arabe contient bien des caractères arabes', () => {
    expect(LOCALES_CONFIG.ar.displayNameNative).toMatch(/[؀-ۿ]/);
  });

  it('la chaîne de fallback est acyclique (pas de boucle infinie)', () => {
    // Vérifie qu'en suivant les fallbacks on atteint null en max 5 sauts.
    for (const start of LOCALES) {
      const visited = new Set<string>();
      let current: string | null = start;
      let hops = 0;
      while (current !== null && hops < 10) {
        if (visited.has(current)) {
          throw new Error(`Cycle détecté dans fallback chain depuis ${start}`);
        }
        visited.add(current);
        current = LOCALES_CONFIG[current as keyof typeof LOCALES_CONFIG]
          ?.fallbackLocale ?? null;
        hops += 1;
      }
      expect(current).toBeNull();
    }
  });
});

describe('i18n.config — getLocaleConfig', () => {
  it('retourne la config pour une locale valide', () => {
    expect(getLocaleConfig('ar').direction).toBe('rtl');
  });

  it('fallback sur DEFAULT_LOCALE pour locale invalide', () => {
    expect(getLocaleConfig('invalid').code).toBe(DEFAULT_LOCALE);
    expect(getLocaleConfig(undefined).code).toBe(DEFAULT_LOCALE);
    expect(getLocaleConfig(null).code).toBe(DEFAULT_LOCALE);
  });

  it('ne throw jamais (fail-soft)', () => {
    expect(() => getLocaleConfig(undefined)).not.toThrow();
    expect(() => getLocaleConfig(null)).not.toThrow();
    expect(() => getLocaleConfig(42)).not.toThrow();
    expect(() => getLocaleConfig({})).not.toThrow();
  });
});

describe('i18n.config — getEnabledLocales', () => {
  it('retourne toutes les locales V1 (toutes enabled)', () => {
    const enabled = getEnabledLocales();
    expect(enabled).toEqual(LOCALES);
  });

  it('exclut les locales avec enabled=false', () => {
    // Snapshot du comportement attendu si on désactivait `en` dynamiquement.
    // Pour ne pas muter le module en test, on simule la logique :
    const filtered = LOCALES.filter((l) => LOCALES_CONFIG[l].enabled);
    expect(filtered).toEqual(getEnabledLocales());
  });
});
