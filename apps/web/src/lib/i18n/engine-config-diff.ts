/**
 * Diff lisible entre deux états de la config moteur (lot L11, audit §5).
 *
 * Reconstruit « qui a changé quoi » à partir des snapshots `before`/`after`
 * stockés dans le meta d'audit `i18n-engine.update`. Fonction **pure** →
 * testable par table de vérité. Tolère des payloads partiels/inconnus
 * (audit historique) en ne produisant aucune ligne plutôt qu'en jetant.
 *
 * @see docs/locale-switcher-v2/10-suggestion-engine/02-config/audit-model.md §5
 */
import {
  type ResolvedEngineConfig,
  safeParseEngineConfig,
} from './engine-config-schema';

export interface ConfigChange {
  field: string;
  before: string;
  after: string;
}

function onOff(v: boolean): string {
  return v ? 'activé' : 'désactivé';
}

function profileMap(cfg: ResolvedEngineConfig) {
  return new Map(cfg.profiles.map((p) => [p.id, p]));
}

/**
 * Compare deux configs et retourne les changements significatifs. `before`
 * absent (1re publication) ⇒ comparé aux défauts OFF. Toute valeur non
 * parseable retombe sur les défauts (INV-13) — jamais d'exception.
 */
export function diffEngineConfig(
  beforeRaw: unknown,
  afterRaw: unknown,
): ConfigChange[] {
  const before = safeParseEngineConfig(beforeRaw);
  const after = safeParseEngineConfig(afterRaw);
  const changes: ConfigChange[] = [];

  if (before.engineEnabled !== after.engineEnabled) {
    changes.push({
      field: 'Moteur',
      before: before.engineEnabled ? 'actif' : 'inactif',
      after: after.engineEnabled ? 'actif' : 'inactif',
    });
  }
  if (before.globalConfidenceFloor !== after.globalConfidenceFloor) {
    changes.push({
      field: 'Plancher de confiance',
      before: String(before.globalConfidenceFloor),
      after: String(after.globalConfidenceFloor),
    });
  }
  if (before.maxImpressionsPerVisitor !== after.maxImpressionsPerVisitor) {
    changes.push({
      field: 'Impressions max / visiteur',
      before: String(before.maxImpressionsPerVisitor),
      after: String(after.maxImpressionsPerVisitor),
    });
  }
  if (before.deferTtlMs !== after.deferTtlMs) {
    changes.push({
      field: 'TTL defer (ms)',
      before: String(before.deferTtlMs),
      after: String(after.deferTtlMs),
    });
  }

  const beforeProfiles = profileMap(before);
  const afterProfiles = profileMap(after);
  for (const [id, ap] of afterProfiles) {
    const bp = beforeProfiles.get(id);
    if (!bp) {
      changes.push({ field: `${id} (profil)`, before: '—', after: 'créé' });
      continue;
    }
    if (bp.enabled !== ap.enabled) {
      changes.push({
        field: `${id} · état`,
        before: onOff(bp.enabled),
        after: onOff(ap.enabled),
      });
    }
    if ((bp.minConfidence ?? null) !== (ap.minConfidence ?? null)) {
      changes.push({
        field: `${id} · confiance`,
        before: String(bp.minConfidence ?? '—'),
        after: String(ap.minConfidence ?? '—'),
      });
    }
    if ((bp.surface ?? null) !== (ap.surface ?? null)) {
      changes.push({
        field: `${id} · surface`,
        before: String(bp.surface ?? '—'),
        after: String(ap.surface ?? '—'),
      });
    }
  }
  for (const [id] of beforeProfiles) {
    if (!afterProfiles.has(id)) {
      changes.push({ field: `${id} (profil)`, before: 'présent', after: 'supprimé' });
    }
  }

  return changes;
}
