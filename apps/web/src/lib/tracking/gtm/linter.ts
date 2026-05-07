/**
 * Linter du container GTM produit.
 *
 * Détecte les incohérences avant qu'un container ne sorte du système.
 * Pure function, synchrone, pas de side-effect. Cf. docs/gtm/17-onboarding-robustness.md §3.5.
 */

import type { GtmContainer, GtmTag } from './types';
import type { GtmEnvConfigDTO } from './config-schema';

export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintIssue {
  code: LintCode;
  severity: LintSeverity;
  message: string;
  refType: 'tag' | 'trigger' | 'variable' | 'config';
  refName: string;
  hint?: string;
}

export type LintCode =
  | 'orphan_trigger'
  | 'tag_no_trigger'
  | 'duplicate_name'
  | 'setup_unknown'
  | 'var_orphan'
  | 'pixel_id_blank'
  | 'convlabel_format';

export interface LintReport {
  errors: LintIssue[];
  warnings: LintIssue[];
  infos: LintIssue[];
  ok: boolean;
}

interface LintInput {
  container: GtmContainer;
  envConfig?: GtmEnvConfigDTO;
}

const CONV_LABEL_REGEX = /^AW-[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/;

function setupTagNames(tag: GtmTag): string[] {
  return (tag.setupTag ?? []).map((s) => s.tagName);
}

function tagReferencesVariable(tag: GtmTag, variableName: string): boolean {
  const ref = `{{${variableName}}}`;
  for (const p of tag.parameter ?? []) {
    if (p.value && p.value.includes(ref)) return true;
    for (const sub of p.list ?? []) if (sub.value?.includes(ref)) return true;
    for (const sub of p.map ?? []) if (sub.value?.includes(ref)) return true;
  }
  return false;
}

function findDuplicateNames(items: { name?: string }[]): string[] {
  const seen = new Map<string, number>();
  for (const it of items) {
    if (!it.name) continue;
    seen.set(it.name, (seen.get(it.name) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, c]) => c > 1).map(([n]) => n);
}

export function lintContainer(input: LintInput): LintReport {
  const { container, envConfig } = input;
  const v = container.containerVersion;
  const tags = v.tag ?? [];
  const triggers = v.trigger ?? [];
  const variables = v.variable ?? [];

  const errors: LintIssue[] = [];
  const warnings: LintIssue[] = [];
  const infos: LintIssue[] = [];

  const triggerByIdMap = new Map<string, string>();
  for (const t of triggers) {
    if (t.triggerId && t.name) triggerByIdMap.set(t.triggerId, t.name);
  }
  const tagNames = new Set<string>();
  for (const t of tags) if (t.name) tagNames.add(t.name);
  const usedTriggerIds = new Set<string>();

  // tag_no_trigger : tag sans firingTriggerId
  for (const tag of tags) {
    if (!tag.firingTriggerId || tag.firingTriggerId.length === 0) {
      errors.push({
        code: 'tag_no_trigger',
        severity: 'error',
        message: `Tag « ${tag.name} » n'a aucun trigger de firing.`,
        refType: 'tag',
        refName: tag.name,
        hint: 'Associe au moins un Custom Event ou un Page View.',
      });
    } else {
      for (const id of tag.firingTriggerId) usedTriggerIds.add(id);
    }
    // setup_unknown : setupTag référence un tag inexistant
    for (const setupName of setupTagNames(tag)) {
      if (!tagNames.has(setupName)) {
        errors.push({
          code: 'setup_unknown',
          severity: 'error',
          message: `Setup tag « ${setupName} » référencé par « ${tag.name} » est introuvable.`,
          refType: 'tag',
          refName: tag.name,
          hint: 'Crée le setup tag avant ou retire la référence.',
        });
      }
    }
  }

  // orphan_trigger : trigger défini mais aucun tag ne le référence
  for (const trigger of triggers) {
    if (!trigger.triggerId) continue;
    if (!usedTriggerIds.has(trigger.triggerId)) {
      warnings.push({
        code: 'orphan_trigger',
        severity: 'warning',
        message: `Trigger « ${trigger.name} » n'est utilisé par aucun tag.`,
        refType: 'trigger',
        refName: trigger.name ?? '(sans nom)',
        hint: 'Soit ajoute un tag qui le déclenche, soit retire-le.',
      });
    }
  }

  // duplicate_name : noms dupliqués (tags / triggers / variables)
  for (const dup of findDuplicateNames(tags)) {
    errors.push({
      code: 'duplicate_name',
      severity: 'error',
      message: `Le nom de tag « ${dup} » apparaît plusieurs fois.`,
      refType: 'tag',
      refName: dup,
      hint: 'Les noms de tags doivent être uniques dans GTM.',
    });
  }
  for (const dup of findDuplicateNames(triggers)) {
    errors.push({
      code: 'duplicate_name',
      severity: 'error',
      message: `Le nom de trigger « ${dup} » apparaît plusieurs fois.`,
      refType: 'trigger',
      refName: dup,
    });
  }
  for (const dup of findDuplicateNames(variables)) {
    errors.push({
      code: 'duplicate_name',
      severity: 'error',
      message: `Le nom de variable « ${dup} » apparaît plusieurs fois.`,
      refType: 'variable',
      refName: dup,
    });
  }

  // var_orphan : variable jamais référencée par un tag
  for (const variable of variables) {
    if (!variable.name) continue;
    const referenced = tags.some((tag) => tagReferencesVariable(tag, variable.name));
    if (!referenced) {
      infos.push({
        code: 'var_orphan',
        severity: 'info',
        message: `Variable « ${variable.name} » n'est référencée par aucun tag.`,
        refType: 'variable',
        refName: variable.name,
        hint: 'Peut être un précurseur pour un usage futur ; envisage de la retirer si non.',
      });
    }
  }

  // pixel_id_blank + convlabel_format : sur l'envConfig si fourni
  if (envConfig) {
    const enabled = new Set(envConfig.enabledProviders ?? []);
    if (enabled.has('google_ga4') && !envConfig.ga4MeasurementId) {
      warnings.push({
        code: 'pixel_id_blank',
        severity: 'warning',
        message: 'GA4 activé mais Measurement ID vide.',
        refType: 'config',
        refName: 'ga4MeasurementId',
        hint: 'Renseigne G-XXXXXXX ou désactive GA4 pour cet env.',
      });
    }
    if (enabled.has('meta') && !envConfig.metaPixelId) {
      warnings.push({
        code: 'pixel_id_blank',
        severity: 'warning',
        message: 'Meta Pixel activé mais ID vide.',
        refType: 'config',
        refName: 'metaPixelId',
      });
    }
    if (enabled.has('tiktok') && !envConfig.tiktokPixelId) {
      warnings.push({
        code: 'pixel_id_blank',
        severity: 'warning',
        message: 'TikTok activé mais Pixel ID vide.',
        refType: 'config',
        refName: 'tiktokPixelId',
      });
    }
    const labels = envConfig.googleAdsConvLabels ?? {};
    for (const [key, value] of Object.entries(labels)) {
      if (value && !CONV_LABEL_REGEX.test(value)) {
        warnings.push({
          code: 'convlabel_format',
          severity: 'warning',
          message: `Conv label « ${key} » au format inattendu (${value}).`,
          refType: 'config',
          refName: `googleAdsConvLabels.${key}`,
          hint: 'Format attendu : AW-XXXXXX/abcDEF.',
        });
      }
    }
  }

  return {
    errors,
    warnings,
    infos,
    ok: errors.length === 0,
  };
}
