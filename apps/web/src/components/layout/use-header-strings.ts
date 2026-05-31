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

import {
  menuEntries as LEGACY_MENU_ENTRIES,
  menuSeasonLabel as LEGACY_SEASON,
  menuSignature as LEGACY_SIGNATURE,
  type MenuEntry,
} from '@/lib/menu-descriptions';
import { routes } from '@/lib/routes';

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
 * Strings du `SommaireOverlay` (menu plein écran). Même pattern dual que
 * `HeaderStrings` : sous provider next-intl → `navigation.*` ; sinon
 * fallback FR depuis `@/lib/menu-descriptions`.
 *
 * Phase 9bis (2026-05) — i18n du chrome AR (le menu fuitait labels +
 * descriptions FR sur /ar).
 */
export interface SommaireStrings {
  summaryTitle: string;
  logoAria: string;
  close: string;
  seasonLabel: string;
  signature: string;
  entries: MenuEntry[];
}

const LEGACY_SOMMAIRE: SommaireStrings = {
  summaryTitle: 'Sommaire de navigation',
  logoAria: 'FemiGlow — Accueil',
  close: 'Fermer',
  seasonLabel: LEGACY_SEASON,
  signature: LEGACY_SIGNATURE,
  entries: LEGACY_MENU_ENTRIES,
};

/**
 * Mapping entrée menu → clés de catalogue `navigation.*`. L'ordre + les
 * `href`/`vignette` restent pilotés par `@/lib/menu-descriptions` (data
 * non traduisible : routes, assets). Seuls `label`/`description` sont
 * localisés.
 */
const MENU_KEY_MAP: ReadonlyArray<{
  href: string;
  labelKey: string;
  descriptionKey: string;
}> = [
  { href: routes.rituel, labelKey: 'rituel', descriptionKey: 'menu.rituel_description' },
  { href: routes.kit, labelKey: 'kit', descriptionKey: 'menu.kit_description' },
  { href: routes.journal, labelKey: 'journal', descriptionKey: 'menu.journal_description' },
  { href: routes.maison, labelKey: 'home', descriptionKey: 'menu.maison_description' },
  { href: routes.contact, labelKey: 'contact', descriptionKey: 'menu.contact_description' },
];

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

export function useSommaireStrings(): SommaireStrings {
  const t = useHeaderTranslator();
  if (!t) return LEGACY_SOMMAIRE;

  const entries: MenuEntry[] = MENU_KEY_MAP.map((map, index) => {
    const legacy = LEGACY_MENU_ENTRIES[index];
    return {
      href: map.href,
      label: safeT(t, map.labelKey, legacy?.label ?? map.labelKey),
      description: safeT(t, map.descriptionKey, legacy?.description ?? ''),
      vignette: legacy?.vignette ?? { src: '', alt: '' },
    };
  });

  return {
    summaryTitle: safeT(t, 'menu_summary', LEGACY_SOMMAIRE.summaryTitle),
    logoAria: safeT(t, 'header_logo_aria', LEGACY_SOMMAIRE.logoAria),
    close: safeT(t, 'menu_close', LEGACY_SOMMAIRE.close),
    seasonLabel: safeT(t, 'menu_season_label', LEGACY_SOMMAIRE.seasonLabel),
    signature: safeT(t, 'menu_signature', LEGACY_SOMMAIRE.signature),
    entries,
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
