/**
 * `lib/seo/seed.ts` — opérations de seed et de reset des `seo_settings`.
 *
 * Deux fonctions publiques :
 *
 *  1. `seedSeoDefaults({ actorId, force })` — idempotent.
 *     - Si `force=false` (défaut), n'écrit en DB que si aucune ligne
 *       `seo_settings` n'est encore présente (détecté via `updatedAt = epoch`,
 *       valeur que `getSeoSettings()` retourne quand il retombe sur les
 *       defaults code).
 *     - Si `force=true`, équivalent à `resetSeoSettingsToDefaults`.
 *     - Usage typique : script CLI `pnpm seed:seo`, post-deploy ou setup
 *       initial d'un nouvel environnement.
 *
 *  2. `resetSeoSettingsToDefaults({ actorId })` — destructif.
 *     - Sauvegarde l'état actuel comme audit event (`meta.previous`) avant
 *       d'écrire, pour permettre un retour en arrière manuel.
 *     - Écrit toujours, peu importe l'état précédent.
 *     - Usage : bouton « Restaurer les paramètres par défaut » de
 *       `/admin/seo/settings`.
 *
 * Les deux fonctions retournent les settings posés (après upsert), et
 * loggent un audit event distinct (`seo.settings.seed` ou
 * `seo.settings.reset`) avec le détail.
 *
 * Aucune dépendance directe à Drizzle : tout passe par
 * `lib/db/queries/seo.ts` pour rester testable et réutilisable côté CLI.
 */
import { logAuditEvent } from '@/lib/audit/log-event';
import { getSeoSettings, upsertSeoSettings } from '@/lib/db/queries/seo';

import { getSeoSettingsDefault } from './defaults';
import type { SeoSettings } from './types';

export interface SeedOptions {
  /** ID de l'admin qui déclenche l'opération (null pour CLI / système). */
  actorId: string | null;
}

export interface SeedDefaultsOptions extends SeedOptions {
  /**
   * Si `true`, écrase la config existante. Sinon, no-op quand la table est
   * déjà initialisée. Défaut : `false`.
   */
  force?: boolean;
}

export interface SeedResult {
  /** Settings retournés après l'opération. */
  settings: SeoSettings;
  /** `true` si l'opération a effectivement écrit en DB. */
  applied: boolean;
  /** Raison de la décision (utile pour les logs CLI). */
  reason: 'fresh-install' | 'already-seeded' | 'forced' | 'reset';
}

/**
 * Détecte si la table `seo_settings` est encore vide.
 *
 * `getSeoSettings()` retourne `seoSettingsDefault` (avec `updatedAt = epoch`)
 * dans deux cas :
 *  - aucune ligne en DB,
 *  - DB indisponible (failsafe).
 *
 * On utilise `updatedAt = new Date(0)` comme sentinelle. C'est la seule
 * façon stable d'identifier le cas "fresh install" sans ajouter une
 * requête supplémentaire (`SELECT 1 FROM seo_settings`).
 *
 * Conséquence : si quelqu'un upsert manuellement avec `updatedAt = 0`,
 * ce sera traité comme "non seedé". Acceptable : c'est un cas synthétique
 * qui n'arrive pas en pratique.
 */
function isFreshInstall(settings: SeoSettings): boolean {
  return settings.updatedAt.getTime() === 0;
}

/**
 * Seed idempotent des `seo_settings` avec les valeurs de
 * `getSeoSettingsDefault()`.
 *
 * Comportement :
 *  - `force=false` (défaut) : applique uniquement si fresh install.
 *  - `force=true` : applique inconditionnellement (équivalent reset).
 *
 * Log un audit event `seo.settings.seed` avec `meta.reason` et `meta.forced`.
 */
export async function seedSeoDefaults(
  options: SeedDefaultsOptions,
): Promise<SeedResult> {
  const current = await getSeoSettings();
  const fresh = isFreshInstall(current);

  if (!fresh && !options.force) {
    // Pas de log d'audit pour un no-op — bruit inutile.
    return { settings: current, applied: false, reason: 'already-seeded' };
  }

  const defaults = getSeoSettingsDefault();
  const settings = await upsertSeoSettings({
    siteName: defaults.siteName,
    defaultDescription: defaults.defaultDescription,
    defaultOgImageMediaId: defaults.defaultOgImageMediaId,
    twitterHandle: defaults.twitterHandle,
    organizationJsonLd: defaults.organizationJsonLd,
    defaultRobotsIndex: defaults.defaultRobotsIndex,
    defaultRobotsFollow: defaults.defaultRobotsFollow,
    knownPages: defaults.knownPages,
    actorId: options.actorId,
  });

  await logAuditEvent({
    action: 'seo.settings.seed',
    actorId: options.actorId,
    resourceType: 'seo_settings',
    resourceId: 'singleton',
    meta: {
      reason: fresh ? 'fresh-install' : 'forced',
      forced: options.force === true,
    },
  });

  return {
    settings,
    applied: true,
    reason: fresh ? 'fresh-install' : 'forced',
  };
}

/**
 * Reset des `seo_settings` vers la config par défaut du module SEO.
 *
 * Écrit toujours, et sauvegarde l'état précédent comme `meta.previous`
 * dans l'audit event `seo.settings.reset` pour faciliter une restauration
 * manuelle (rollback éditorial).
 */
export async function resetSeoSettingsToDefaults(
  options: SeedOptions,
): Promise<SeedResult> {
  const previous = await getSeoSettings();
  const defaults = getSeoSettingsDefault();

  const settings = await upsertSeoSettings({
    siteName: defaults.siteName,
    defaultDescription: defaults.defaultDescription,
    defaultOgImageMediaId: defaults.defaultOgImageMediaId,
    twitterHandle: defaults.twitterHandle,
    organizationJsonLd: defaults.organizationJsonLd,
    defaultRobotsIndex: defaults.defaultRobotsIndex,
    defaultRobotsFollow: defaults.defaultRobotsFollow,
    knownPages: defaults.knownPages,
    actorId: options.actorId,
  });

  await logAuditEvent({
    action: 'seo.settings.reset',
    actorId: options.actorId,
    resourceType: 'seo_settings',
    resourceId: 'singleton',
    meta: {
      // Snapshot complet de l'état précédent — permet une restauration
      // manuelle ou une analyse a posteriori sans dépendre des snapshots
      // par-cible (qui ne couvrent que les overrides).
      previous: {
        siteName: previous.siteName,
        defaultDescription: previous.defaultDescription,
        defaultOgImageMediaId: previous.defaultOgImageMediaId,
        twitterHandle: previous.twitterHandle,
        defaultRobotsIndex: previous.defaultRobotsIndex,
        defaultRobotsFollow: previous.defaultRobotsFollow,
        organizationJsonLd: previous.organizationJsonLd,
        knownPagesCount: previous.knownPages.length,
        updatedAt: previous.updatedAt.toISOString(),
        updatedBy: previous.updatedBy,
      },
    },
  });

  return { settings, applied: true, reason: 'reset' };
}
