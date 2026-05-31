/**
 * Parser CSV pour l'import bulk de Pixel IDs / variables GTM.
 *
 * Format attendu :
 *   env,variable,value
 *   production,ga4MeasurementId,G-PROD0000
 *   stage,googleAdsConvLabels.purchase,AW-XXX/abc
 *
 * Cf. docs/gtm/17-onboarding-robustness.md §3.2.
 */

import {
  GTM_ENVS,
  emptyEnvConfig,
  type GtmConfigPerEnv,
  type GtmEnv,
  type GtmEnvConfigDTO,
} from './config-schema';

export interface CsvImportRow {
  env: GtmEnv;
  variable: string;
  value: string;
}

export interface CsvImportResult {
  rows: CsvImportRow[];
  warnings: string[];
  perEnv: GtmConfigPerEnv;
  appliedCount: number;
  skippedCount: number;
}

const VALID_ENVS = new Set<string>(GTM_ENVS);
const KNOWN_VARS = new Set([
  'ga4MeasurementId',
  'metaPixelId',
  'tiktokPixelId',
  'snapPixelId',
  'pinterestTagId',
  'googleAdsCustomerId',
  'defaultCurrency',
  'cookieDomain',
  'googleAdsConvLabels.purchase',
  'googleAdsConvLabels.lead',
  'googleAdsConvLabels.signup',
  'googleAdsConvLabels.initCheckout',
]);

const MAX_LINES = 1000;

/** Parse une ligne CSV en respectant les quotes (RFC 4180 simplifié). */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') {
        out.push(cur);
        cur = '';
      } else cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Parse le CSV brut et fusionne dans un perEnv de base (defaults).
 * Variables inconnues → warning, ignorées.
 */
export function parseCsvImport(
  csv: string,
  base?: GtmConfigPerEnv,
): CsvImportResult {
  const rows: CsvImportRow[] = [];
  const warnings: string[] = [];
  const perEnv: GtmConfigPerEnv = base
    ? { ...base }
    : {
        production: emptyEnvConfig(),
        stage: emptyEnvConfig(),
        preview: emptyEnvConfig(),
        dev: emptyEnvConfig(),
      };
  let appliedCount = 0;
  let skippedCount = 0;

  const allLines = csv.split(/\r?\n/);
  if (allLines.length > MAX_LINES) {
    warnings.push(
      `Le fichier dépasse ${MAX_LINES} lignes ; les suivantes ont été ignorées.`,
    );
  }
  const lines = allLines.slice(0, MAX_LINES);

  let started = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    if (!raw.trim()) continue;
    const cells = parseCsvLine(raw);
    if (cells.length < 3) {
      warnings.push(`Ligne ${i + 1} : moins de 3 colonnes, ignorée.`);
      skippedCount++;
      continue;
    }
    // Header optionnel : si la première ligne contient `env`, `variable`, `value`, on saute.
    if (
      !started &&
      cells[0]?.toLowerCase() === 'env' &&
      cells[1]?.toLowerCase() === 'variable' &&
      cells[2]?.toLowerCase() === 'value'
    ) {
      started = true;
      continue;
    }
    started = true;

    const [envRaw, variable, value] = cells;
    if (!envRaw || !variable) {
      skippedCount++;
      continue;
    }
    if (!VALID_ENVS.has(envRaw)) {
      warnings.push(`Ligne ${i + 1} : env « ${envRaw} » inconnu, ignoré.`);
      skippedCount++;
      continue;
    }
    if (!KNOWN_VARS.has(variable)) {
      warnings.push(`Ligne ${i + 1} : variable « ${variable} » inconnue, ignorée.`);
      skippedCount++;
      continue;
    }

    const env = envRaw as GtmEnv;
    rows.push({ env, variable, value: value ?? '' });
    perEnv[env] = applyVariable(perEnv[env], variable, value ?? '');
    appliedCount++;
  }

  return { rows, warnings, perEnv, appliedCount, skippedCount };
}

function applyVariable(
  cfg: GtmEnvConfigDTO,
  variable: string,
  value: string,
): GtmEnvConfigDTO {
  if (variable.startsWith('googleAdsConvLabels.')) {
    const key = variable.slice('googleAdsConvLabels.'.length) as
      | 'purchase'
      | 'lead'
      | 'signup'
      | 'initCheckout';
    return {
      ...cfg,
      googleAdsConvLabels: { ...(cfg.googleAdsConvLabels ?? {}), [key]: value },
    };
  }
  return { ...cfg, [variable]: value };
}
