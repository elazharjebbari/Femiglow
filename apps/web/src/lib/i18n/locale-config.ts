/**
 * Locale Switcher V2 — resolver de config (lot L4).
 *
 * Lit la section `i18n_locale_config` depuis `app_config` (ADR-009),
 * valide (fallback défauts, INV-12), et cache le résultat. Lecture
 * publique (pas d'auth) — la config ne contient rien de sensible.
 *
 * @see docs/locale-switcher-v2/04-backend/api-contracts.md
 */
import { unstable_cache } from 'next/cache';

import { getAppConfigRow } from '@/lib/db/queries/app-config';

import {
  DEFAULT_LOCALE_CONFIG,
  safeParseLocaleConfig,
  type LocaleConfig,
} from './locale-config-schema';

export const LOCALE_CONFIG_SECTION = 'i18n_locale_config';
export const LOCALE_CONFIG_TAG = 'i18n-locale-config';

/** Lecture brute (non cachée) : row → validée → défauts si absente/invalide. */
export async function fetchLocaleConfig(): Promise<LocaleConfig> {
  try {
    const row = await getAppConfigRow(LOCALE_CONFIG_SECTION);
    if (!row) return DEFAULT_LOCALE_CONFIG;
    return safeParseLocaleConfig(row.payload);
  } catch {
    // DB indisponible → défauts (INV-12), jamais d'erreur 500 sur la lecture.
    return DEFAULT_LOCALE_CONFIG;
  }
}

/** Lecture cachée (tag `i18n-locale-config`, invalidée à l'écriture admin). */
export const getResolvedLocaleConfig = unstable_cache(
  fetchLocaleConfig,
  [LOCALE_CONFIG_TAG],
  { tags: [LOCALE_CONFIG_TAG], revalidate: 300 },
);
