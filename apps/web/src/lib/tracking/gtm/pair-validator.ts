import type { PairValidationResult, ValidationIssue, Recommendation } from './sentinel-schemas';
import { isValidBundleId } from './bundle-id';

/**
 * Couche A — Valide la cohérence d'une paire (config GTM, mapping FemiGlow)
 * AVANT que l'admin ne les importe dans GTM.
 *
 * Stateless, déterministe.
 * cf. docs/gtm-poka-yoke/30-backend/02-pair-validator.md
 */

export type PairValidationInput = {
  configJson: unknown;
  mappingJson: unknown;
};

export function validatePair(input: PairValidationInput): PairValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // R-009 — JSON well-formed (court-circuit)
  if (!isPlainObject(input.configJson)) {
    return earlyError({
      code: 'invalid_config_json',
      message: 'La config GTM n\'est pas un JSON object valide.',
      fix: 'Vérifier que le fichier est un export GTM valide (.json).',
    });
  }
  if (!isPlainObject(input.mappingJson)) {
    return earlyError({
      code: 'invalid_mapping_json',
      message: 'Le mapping n\'est pas un JSON object valide.',
      fix: 'Vérifier que le fichier est un mapping FemiGlow valide.',
    });
  }

  const config = input.configJson as Record<string, unknown>;
  const mapping = input.mappingJson as Record<string, unknown>;

  // Extract bundleId from each side
  const configBundleId = extractConfigBundleId(config);
  const mappingBundleId = extractMappingBundleId(mapping);

  // R-001 — Bundle ID match
  if (configBundleId && mappingBundleId) {
    if (configBundleId !== mappingBundleId) {
      errors.push({
        code: 'bundle_mismatch',
        severity: 'error',
        message: `Bundle ID incohérent : config=${configBundleId} ≠ mapping=${mappingBundleId}.`,
        fix: 'Re-générer les 2 fichiers ENSEMBLE depuis /admin/tracking/events/mappings (l\'export produit les 2 avec le même bundleId).',
      });
    }
  } else if (!configBundleId) {
    warnings.push({
      code: 'config_bundle_id_missing',
      severity: 'warning',
      message: 'La config GTM ne déclare pas de variable "FG Bundle Id".',
      fix: 'Ajouter une variable constante "FG Bundle Id" à la config GTM, ou re-exporter depuis l\'admin.',
    });
  } else if (!mappingBundleId) {
    warnings.push({
      code: 'mapping_bundle_id_missing',
      severity: 'warning',
      message: 'Le mapping ne déclare pas de bundleId dans son manifest.',
      fix: 'Re-exporter le mapping depuis /admin/tracking/events/mappings.',
    });
  }

  // R-002 — Schema version
  const schemaVersion = extractSchemaVersion(mapping);
  if (!schemaVersion || !/^fg-mapping\/\d+\.\d+$/.test(schemaVersion)) {
    errors.push({
      code: 'invalid_schema_version',
      severity: 'error',
      message: `Schema version du mapping inconnue : ${schemaVersion ?? '(absent)'}.`,
      fix: 'Re-exporter le mapping depuis l\'admin actuel.',
    });
  }

  // R-003 — Container ID match
  const configContainerId = extractConfigContainerId(config);
  const mappingContainerId = extractMappingContainerId(mapping);
  if (configContainerId && mappingContainerId && configContainerId !== mappingContainerId) {
    errors.push({
      code: 'container_id_mismatch',
      severity: 'error',
      message: `Container ID différent : config=${configContainerId} ≠ mapping=${mappingContainerId}.`,
      fix: 'Vérifier que tu cibles le bon workspace GTM (prod vs staging) et re-exporter.',
    });
  }

  // R-006 — Required config version
  const requiredConfigVersion = extractRequiredConfigVersion(mapping);
  const actualConfigVersion = extractConfigVersion(config);
  if (requiredConfigVersion && actualConfigVersion && compareVersion(actualConfigVersion, requiredConfigVersion) < 0) {
    errors.push({
      code: 'config_too_old',
      severity: 'error',
      message: `Mapping attend config ≥ ${requiredConfigVersion}, mais la config fournie est ${actualConfigVersion}.`,
      fix: `Mettre à jour la config GTM vers ${requiredConfigVersion} avant l'import du mapping.`,
    });
  }

  // R-005 — Variables resolvable
  const referencedVars = extractReferencedVariables(mapping);
  const definedVars = extractDefinedVariables(config);
  for (const v of referencedVars) {
    if (!definedVars.has(v)) {
      errors.push({
        code: 'missing_variable',
        severity: 'error',
        message: `Variable {{${v}}} référencée par le mapping mais absente de la config GTM.`,
        fix: `Ajouter la variable "${v}" dans la config GTM (type Constant ou Data Layer Variable) avant l'import.`,
      });
    }
  }

  // R-004 — Events couverts (mapping vs config)
  const mappingEvents = extractMappingEvents(mapping);
  const configEvents = extractConfigEventTriggers(config);
  for (const e of mappingEvents) {
    if (!configEvents.has(e)) {
      warnings.push({
        code: 'event_not_covered_by_config',
        severity: 'warning',
        message: `Event "${e}" mappé mais aucun trigger correspondant dans la config GTM.`,
        fix: `Ajouter un trigger "${e}" dans la config GTM, ou retirer "${e}" du mapping.`,
      });
    }
  }
  for (const e of configEvents) {
    if (!mappingEvents.has(e)) {
      warnings.push({
        code: 'event_orphan_in_config',
        severity: 'warning',
        message: `Event "${e}" configuré dans GTM mais absent du mapping.`,
        fix: `Cet event sera fired avec son nom canonique. Si voulu, l'ajouter au mapping pour traçabilité.`,
      });
    }
  }

  const recommendations = buildRecommendations(errors, warnings);

  return {
    ok: errors.length === 0,
    bundleId: {
      config: configBundleId,
      mapping: mappingBundleId,
      match: !!configBundleId && configBundleId === mappingBundleId,
    },
    errors,
    warnings,
    recommendations,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function earlyError(issue: Omit<ValidationIssue, 'severity'>): PairValidationResult {
  return {
    ok: false,
    bundleId: { config: null, mapping: null, match: false },
    errors: [{ ...issue, severity: 'error' }],
    warnings: [],
    recommendations: [{ order: 1, action: 'Corriger les erreurs ci-dessus avant l\'import.' }],
  };
}

function extractConfigBundleId(config: Record<string, unknown>): string | null {
  const variables = pathToArray(config, ['containerVersion', 'variable']);
  for (const v of variables) {
    if (isPlainObject(v) && v.name === 'FG Bundle Id') {
      const params = Array.isArray(v.parameter) ? v.parameter : [];
      for (const p of params) {
        if (isPlainObject(p) && p.key === 'value' && typeof p.value === 'string' && isValidBundleId(p.value)) {
          return p.value;
        }
      }
    }
  }
  return null;
}

function extractMappingBundleId(mapping: Record<string, unknown>): string | null {
  const manifest = mapping.manifest;
  if (isPlainObject(manifest) && typeof manifest.bundleId === 'string' && isValidBundleId(manifest.bundleId)) {
    return manifest.bundleId;
  }
  return null;
}

function extractSchemaVersion(mapping: Record<string, unknown>): string | null {
  const manifest = mapping.manifest;
  if (isPlainObject(manifest) && typeof manifest.schemaVersion === 'string') return manifest.schemaVersion;
  return null;
}

function extractConfigContainerId(config: Record<string, unknown>): string | null {
  const cv = config.containerVersion;
  if (isPlainObject(cv) && isPlainObject(cv.container) && typeof cv.container.publicId === 'string') {
    return cv.container.publicId;
  }
  return null;
}

function extractMappingContainerId(mapping: Record<string, unknown>): string | null {
  const manifest = mapping.manifest;
  if (isPlainObject(manifest) && typeof manifest.containerId === 'string') return manifest.containerId;
  return null;
}

function extractRequiredConfigVersion(mapping: Record<string, unknown>): string | null {
  const manifest = mapping.manifest;
  if (isPlainObject(manifest) && typeof manifest.requiredConfigVersion === 'string') return manifest.requiredConfigVersion;
  return null;
}

function extractConfigVersion(config: Record<string, unknown>): string | null {
  const variables = pathToArray(config, ['containerVersion', 'variable']);
  for (const v of variables) {
    if (isPlainObject(v) && v.name === 'FG Config Version') {
      const params = Array.isArray(v.parameter) ? v.parameter : [];
      for (const p of params) {
        if (isPlainObject(p) && p.key === 'value' && typeof p.value === 'string') return p.value;
      }
    }
  }
  return null;
}

function extractReferencedVariables(mapping: Record<string, unknown>): Set<string> {
  const refs = new Set<string>();
  const serialized = JSON.stringify(mapping);
  const re = /\{\{([^}]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(serialized)) !== null) {
    refs.add(m[1]!.trim());
  }
  return refs;
}

function extractDefinedVariables(config: Record<string, unknown>): Set<string> {
  const defined = new Set<string>();
  const variables = pathToArray(config, ['containerVersion', 'variable']);
  for (const v of variables) {
    if (isPlainObject(v) && typeof v.name === 'string') defined.add(v.name);
  }
  // Built-in GTM variables (heuristique : on accepte sans les vérifier)
  const builtIns = ['Container ID', 'GTM Container ID', 'Page URL', 'Page Path', 'Event'];
  for (const name of builtIns) defined.add(name);
  return defined;
}

function extractMappingEvents(mapping: Record<string, unknown>): Set<string> {
  const events = new Set<string>();
  const m = mapping.mappings;
  if (isPlainObject(m)) {
    for (const k of Object.keys(m)) events.add(k);
  }
  return events;
}

function extractConfigEventTriggers(config: Record<string, unknown>): Set<string> {
  const events = new Set<string>();
  const triggers = pathToArray(config, ['containerVersion', 'trigger']);
  for (const t of triggers) {
    if (isPlainObject(t)) {
      // GTM trigger custom event filter convention: parameter "key=eventName, value=<eventName>"
      const params = Array.isArray(t.parameter) ? t.parameter : [];
      for (const p of params) {
        if (isPlainObject(p) && p.key === 'eventName' && typeof p.value === 'string') events.add(p.value);
      }
      // Fallback : nom du trigger
      if (typeof t.name === 'string' && t.name.toLowerCase().startsWith('event ')) {
        events.add(t.name.slice(6).trim());
      }
    }
  }
  return events;
}

function pathToArray(obj: Record<string, unknown>, path: string[]): unknown[] {
  let cur: unknown = obj;
  for (const p of path) {
    if (isPlainObject(cur) && p in cur) cur = (cur as Record<string, unknown>)[p];
    else return [];
  }
  return Array.isArray(cur) ? cur : [];
}

function compareVersion(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const av = parse(a);
  const bv = parse(b);
  for (let i = 0; i < Math.max(av.length, bv.length); i++) {
    const x = av[i] ?? 0;
    const y = bv[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function buildRecommendations(errors: ValidationIssue[], warnings: ValidationIssue[]): Recommendation[] {
  if (errors.length > 0) {
    return [{ order: 1, action: 'Corriger les erreurs ci-dessus avant l\'import.' }];
  }
  const recs: Recommendation[] = [
    { order: 1, action: 'Importer la config GTM en premier (Submit & Publish).' },
    { order: 2, action: 'Importer le mapping en second (Submit & Publish).' },
    { order: 3, action: 'Ouvrir GTM Preview Mode, faire un pageview, vérifier que le sentinel ping est tiré.' },
    { order: 4, action: 'Revenir sur /admin/tracking/gtm/sync-status pour confirmer ✓.' },
  ];
  if (warnings.length > 0) {
    recs.push({ order: 5, action: 'Surveiller les warnings ci-dessus pendant 24h.' });
  }
  return recs;
}
