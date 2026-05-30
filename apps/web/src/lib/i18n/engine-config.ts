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

export interface AdminEngineConfig {
  payload: ResolvedEngineConfig;
  version: number;
  updatedAt: string;
  updatedBy: { id: string; email: string } | null;
  isDefault: boolean;
}

/**
 * Lecture admin **non cachée** : expose la `version` (pour le `If-Match`
 * optimiste) et le meta d'audit. Payload toujours validé → défauts OFF si la
 * row est absente ou invalide (INV-13). Jamais d'erreur propagée.
 */
export async function getAdminEngineConfig(): Promise<AdminEngineConfig> {
  const row = await getAppConfigRow(ENGINE_CONFIG_SECTION);
  if (!row) {
    return {
      payload: DEFAULT_ENGINE_CONFIG,
      version: 0,
      updatedAt: new Date(0).toISOString(),
      updatedBy: null,
      isDefault: true,
    };
  }
  const payload = safeParseEngineConfig(row.payload);
  const isDefault =
    JSON.stringify(payload) === JSON.stringify(DEFAULT_ENGINE_CONFIG);
  return {
    payload,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
    isDefault,
  };
}
