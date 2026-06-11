/**
 * Configuration i18n FemiGlow — source unique des locales supportées.
 *
 * Ce fichier est le **point d'entrée canonique** pour tout ce qui touche aux
 * locales : middleware, routing, providers, validation Zod, helpers DB.
 * Toute évolution (ajout de langue, default, etc.) passe ici en premier.
 *
 * @see docs/i18n-strategy-2026-05/02-design-conception/url-strategy.md
 * @see docs/i18n-strategy-2026-05/00-context/adrs.md (ADR-004 « locales V1 »)
 */

// ---------------------------------------------------------------------------
// Locales supportées (V1)
// ---------------------------------------------------------------------------

/**
 * Liste exhaustive des locales supportées par l'application.
 *
 * Ordre important : la première est le `DEFAULT_LOCALE`. Pour activer
 * ou désactiver une locale en production, modifier la liste ici puis
 * `LOCALES_CONFIG.enabled` ci-dessous.
 *
 * Codes BCP-47 :
 * - `fr` : français (Maroc / France / international francophone)
 * - `ar` : arabe MSA simplifié (Maroc, diaspora arabophone, RTL)
 * - `en` : anglais international (tier-1 markets)
 */
export const LOCALES = ['fr', 'ar', 'en'] as const;

/** Locale par défaut. Utilisée pour fallback, root path, et SEO `x-default`. */
export const DEFAULT_LOCALE = 'fr' as const;

/**
 * Type Locale dérivé de `LOCALES`. Utiliser ce type partout au lieu de `string`
 * pour bénéficier de la complétion TS et empêcher l'usage de codes invalides.
 */
export type Locale = (typeof LOCALES)[number];

// ---------------------------------------------------------------------------
// Helpers de type
// ---------------------------------------------------------------------------

/**
 * Type guard : vérifie qu'une string est une locale supportée.
 *
 * @example
 * if (isLocale(input)) {
 *   // input est de type Locale ici
 *   useRouter().push(`/${input}/kit`);
 * }
 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Coerce une valeur inconnue en Locale, avec fallback sur `DEFAULT_LOCALE`.
 * Utile aux endroits où on reçoit une string (cookie, header) et qu'on veut
 * une garantie de validité sans throw.
 */
export function coerceLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

// ---------------------------------------------------------------------------
// Configuration détaillée par locale
// ---------------------------------------------------------------------------

/**
 * Métadonnées d'une locale : affichage UI, direction, formatage,
 * fallback chain, statut actif.
 */
export interface LocaleConfig {
  /** Code BCP-47 (ex: 'fr', 'ar', 'ar-MA') */
  code: Locale;
  /** Nom à afficher en FR (pour switcher en contexte FR) */
  displayName: string;
  /** Nom à afficher dans la locale elle-même (endonyme) */
  displayNameNative: string;
  /** Direction de lecture */
  direction: 'ltr' | 'rtl';
  /** Emoji drapeau (uniquement pour switcher visuel — pas SEO) */
  flagEmoji: string;
  /** Locale de fallback si une clé manque. `null` pour locale racine. */
  fallbackLocale: Locale | null;
  /** Code monnaie ISO 4217 par défaut pour cette locale */
  currencyCode: 'MAD' | 'EUR' | 'USD';
  /** Locale BCP-47 utilisée par `Intl.NumberFormat` / `Intl.DateTimeFormat` */
  intlLocale: string;
  /** Est-ce que cette locale est actuellement servie au public ? */
  enabled: boolean;
}

/** Configuration de chaque locale. */
export const LOCALES_CONFIG: Record<Locale, LocaleConfig> = {
  fr: {
    code: 'fr',
    displayName: 'Français',
    displayNameNative: 'Français',
    direction: 'ltr',
    flagEmoji: '🇫🇷',
    fallbackLocale: null,
    currencyCode: 'MAD',
    intlLocale: 'fr-MA',
    enabled: true,
  },
  ar: {
    code: 'ar',
    displayName: 'Arabe',
    displayNameNative: 'العربية',
    direction: 'rtl',
    flagEmoji: '🇲🇦',
    fallbackLocale: 'fr',
    currencyCode: 'MAD',
    intlLocale: 'ar-MA',
    enabled: true,
  },
  en: {
    code: 'en',
    displayName: 'Anglais',
    displayNameNative: 'English',
    direction: 'ltr',
    flagEmoji: '🇬🇧',
    fallbackLocale: 'fr',
    currencyCode: 'MAD',
    intlLocale: 'en-US',
    enabled: true,
  },
};

/**
 * Récupère la configuration d'une locale. Si la locale est invalide,
 * retourne celle du `DEFAULT_LOCALE` (jamais de throw — fail-soft).
 */
export function getLocaleConfig(locale: unknown): LocaleConfig {
  const safe = coerceLocale(locale);
  return LOCALES_CONFIG[safe];
}

/** Liste des locales actuellement activées en production. */
export function getEnabledLocales(): readonly Locale[] {
  return LOCALES.filter((l) => LOCALES_CONFIG[l].enabled);
}

// ---------------------------------------------------------------------------
// Constantes d'infrastructure
// ---------------------------------------------------------------------------

/**
 * Nom du cookie qui mémorise le choix explicite de l'utilisateur.
 * Lisible côté client (pour switcher UI), `SameSite=Lax`, 1 an.
 * Cf. `02-design-conception/locale-detection.md` §5.
 */
export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

/** Durée de vie du cookie (en secondes) : 1 an. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Stratégie de préfixe URL.
 * - `'always'`  : toutes les routes ont `/[locale]/` (recommandé SEO multi-pays)
 * - `'as-needed'` : seul `defaultLocale` peut être sans préfixe (compat legacy)
 *
 * Cf. ADR-002 — on a choisi `'always'`.
 */
export const LOCALE_PREFIX_STRATEGY = 'always' as const;
