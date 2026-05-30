/**
 * Moteur de suggestion — resolver de config (lot L10).
 *
 * Lit la section `i18n_suggestion_engine` depuis `app_config` (ADR-009),
 * valide (fallback défauts moteur OFF, INV-13), et cache le résultat.
 * Même pattern que `locale-config.ts` (L4) : `unstable_cache` + tag
 * invalidé à l'écriture admin (L11).
 *
 * @see docs/locale-switcher-v2/10-suggestion-engine/02-config/engine-config-schema.yaml
 */
import { unstable_cache } from 'next/cache';

import { getAppConfigRow } from '@/lib/db/queries/app-config';

import {
  DEFAULT_ENGINE_CONFIG,
  safeParseEngineConfig,
  type ResolvedEngineConfig,
} from './engine-config-schema';

export const ENGINE_CONFIG_SECTION = 'i18n_suggestion_engine';
export const ENGINE_CONFIG_TAG = 'i18n-suggestion-engine';

/** Lecture brute (non cachée) : row → validée → défauts OFF si absente/invalide. */
export async function fetchEngineConfig(): Promise<ResolvedEngineConfig> {
  try {
    const row = await getAppConfigRow(ENGINE_CONFIG_SECTION);
    if (!row) return DEFAULT_ENGINE_CONFIG;
    return safeParseEngineConfig(row.payload);
  } catch {
    // DB indisponible → défauts moteur OFF (INV-13), jamais d'erreur.
    return DEFAULT_ENGINE_CONFIG;
  }
}

/** Lecture cachée (tag `i18n-suggestion-engine`, invalidée à l'écriture admin). */
export const getResolvedEngineConfig = unstable_cache(
  fetchEngineConfig,
  [ENGINE_CONFIG_TAG],
  { tags: [ENGINE_CONFIG_TAG], revalidate: 300 },
);
