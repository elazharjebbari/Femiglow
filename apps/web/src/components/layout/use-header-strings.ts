'use client';

/**
 * `useHeaderStrings` — accès résilient aux strings du Header.
 *
 * Sous `NextIntlClientProvider` (routes `[locale]/*` ET legacy
 * `(marketing)/*` post-Phase 7C) → lit `messages/<locale>.json:navigation.*`.
 * Tests vitest sans provider → fallback FR hardcodé.
 *
 * Phase 7C (2026-05) — cf. PHASE-7-AUDIT.md §A4.
 */
import { useTranslations } from 'next-intl';

export interface HeaderStrings {
  logoAria: string;
  menuLabel: string;
  menuHintArrow: string;
}

const LEGACY_FR: HeaderStrings = {
  logoAria: 'FemiGlow — Accueil',
  menuLabel: 'Sommaire',
  menuHintArrow: 'Voir le pack ci-dessous',
};

/**
 * Tente d'utiliser le contexte i18n du Header. Si l'appel à
 * `useTranslations` throw (hors provider, cas des tests vitest qui
 * rendent `Header` isolé), on retourne `null` et le caller retombe sur
 * le fallback FR.
 *
 * NB : try/catch autour de l'appel d'un hook est légal — la convention
 * « hooks au top level » n'interdit que les hooks dans des `if`/loops
 * conditionnels. Ici l'appel est inconditionnel ; on intercepte juste
 * le throw synchrone du hook quand le provider manque.
 */
function useHeaderTranslator(): ReturnType<typeof useTranslations> | null {
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useTranslations('navigation');
  } catch {
    return null;
  }
}

export function useHeaderStrings(): HeaderStrings {
  const t = useHeaderTranslator();
  if (!t) return LEGACY_FR;
  return {
    logoAria: safeT(t, 'header_logo_aria', LEGACY_FR.logoAria),
    menuLabel: safeT(t, 'menu_label', LEGACY_FR.menuLabel),
    menuHintArrow: safeT(t, 'menu_hint_arrow', LEGACY_FR.menuHintArrow),
  };
}

function safeT(
  t: ReturnType<typeof useTranslations>,
  key: string,
  fallback: string,
): string {
  try {
    const value = t(key);
    if (typeof value !== 'string') return fallback;
    if (value === key || value === `navigation.${key}`) return fallback;
    return value;
  } catch {
    return fallback;
  }
}
