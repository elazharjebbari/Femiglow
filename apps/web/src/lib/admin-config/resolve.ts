/**
 * Resolver Admin-Config — cascade defaults → DB row → validated, avec failsafe.
 *
 * - `getAppConfig()` : retourne la configuration résolue (toutes sections).
 * - `getSection(section)` : retourne une section avec son meta (version, actor).
 *
 * Tous deux wrappés `unstable_cache` avec tag `app-config` (et per-section).
 * cf. docs/admin-config/architecture/03-cascade.md
 */
import { unstable_cache } from 'next/cache';
import { logger } from '@/lib/logging/logger';
import { getAppConfigRow } from '@/lib/db/queries/app-config';
import { sectionSchemas } from './schemas';
import { defaults, getDefault } from './defaults';
import {
  SECTIONS,
  type ConfigMeta,
  type ResolvedAppConfig,
  type ResolvedSection,
  type Section,
  type SectionPayloadMap,
} from './types';

export const APP_CONFIG_TAG = 'app-config';
export const sectionTag = (section: Section) => `app-config:${section}`;

interface PlainRow {
  section: Section;
  payload: unknown;
  version: number;
  updatedAt: Date | string;
  updatedBy: { id: string; email: string } | null;
}

/**
 * Tente de valider un payload DB contre le schéma de sa section.
 * Si fail → log warn + null (caller fallback sur default).
 */
function safeValidate<S extends Section>(
  section: S,
  payload: unknown,
): SectionPayloadMap[S] | null {
  const parsed = sectionSchemas[section].safeParse(payload);
  if (!parsed.success) {
    logger.warn('admin_config.zod_fail', {
      section,
      issues: parsed.error.issues.slice(0, 6),
    });
    return null;
  }
  return parsed.data as SectionPayloadMap[S];
}

function defaultMeta(): ConfigMeta {
  return {
    version: 0,
    updatedAt: new Date(0).toISOString(),
    updatedBy: null,
    isDefault: true,
  };
}

function rowMeta(row: PlainRow, isDefault: boolean): ConfigMeta {
  return {
    version: row.version,
    updatedAt:
      row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    updatedBy: row.updatedBy,
    isDefault,
  };
}

async function resolveSectionUncached<S extends Section>(
  section: S,
): Promise<ResolvedSection<S>> {
  const row = (await getAppConfigRow(section)) as PlainRow | null;
  if (!row) {
    return {
      section,
      payload: getDefault(section) as ResolvedSection<S>['payload'],
      meta: defaultMeta(),
    };
  }
  const validated = safeValidate(section, row.payload);
  if (!validated) {
    // Failsafe : payload DB invalide → on retombe sur les defaults TS
    return {
      section,
      payload: getDefault(section) as ResolvedSection<S>['payload'],
      meta: rowMeta(row, true),
    };
  }
  // Comparaison structurelle pour le badge "valeur défaut"
  const isDefault = JSON.stringify(validated) === JSON.stringify(getDefault(section));
  return {
    section,
    payload: validated as ResolvedSection<S>['payload'],
    meta: rowMeta(row, isDefault),
  };
}

/**
 * Récupère une section résolue avec cache `unstable_cache`. Le cache est
 * invalidé via `revalidateTag('app-config')` ou `revalidateTag('app-config:<section>')`.
 */
export async function getSection<S extends Section>(
  section: S,
): Promise<ResolvedSection<S>> {
  const cached = unstable_cache(
    async () => resolveSectionUncached(section),
    ['admin-config', section],
    { tags: [APP_CONFIG_TAG, sectionTag(section)] },
  );
  return cached() as Promise<ResolvedSection<S>>;
}

/**
 * Récupère toutes les sections résolues. Utile pour la page racine
 * `/admin/settings` (4 cartes) et l'init d'`AdminShell`.
 */
export async function getAppConfig(): Promise<ResolvedAppConfig> {
  const sections = await Promise.all(SECTIONS.map((s) => getSection(s)));
  const meta = {} as Record<Section, ConfigMeta>;
  const out = { ...defaults } as Record<Section, unknown>;
  for (const r of sections) {
    out[r.section] = r.payload;
    meta[r.section] = r.meta;
  }
  return {
    nav: out.nav as ResolvedAppConfig['nav'],
    flags: out.flags as ResolvedAppConfig['flags'],
    rbac: out.rbac as ResolvedAppConfig['rbac'],
    branding: out.branding as ResolvedAppConfig['branding'],
    meta,
  };
}

export { SECTIONS };
