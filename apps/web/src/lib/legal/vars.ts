import { env } from '@/lib/env';

const VAR_PATTERN = /\{\{([A-Z][A-Z0-9_]*)\}\}/g;

const FR_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatFrenchDate(d: Date): string {
  return `${d.getDate()} ${FR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function presetVars(now: Date = new Date()): Map<string, string> {
  const m = new Map<string, string>();
  m.set('LAST_UPDATED', formatFrenchDate(now));
  m.set('CURRENT_YEAR', String(now.getFullYear()));
  m.set('SITE_URL', env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, ''));
  return m;
}

export function isPresetVar(key: string): boolean {
  return (
    key === 'LAST_UPDATED' ||
    key === 'CURRENT_YEAR' ||
    key === 'SITE_URL' ||
    key === 'VERSION' // LEGAL-V2-01 — VERSION devient preset auto
  );
}

/**
 * LEGAL-V2 — Presets dérivés d'une page spécifique.
 * Étend presetVars() avec VERSION et LAST_UPDATED contextuels (basés sur
 * la page elle-même, pas le moment du render).
 *
 * Cf. docs/pages-legales-fix-2026-05/01-design-conception/api-contracts.md
 */
export function presetVarsForPage(
  page: { version: number; updatedAt: Date },
  now: Date = new Date(),
): Map<string, string> {
  const m = presetVars(now);
  m.set('VERSION', `v${page.version}`);
  m.set('LAST_UPDATED', formatFrenchDate(page.updatedAt));
  return m;
}

export type SubstituteMode = 'public' | 'admin-preview';

export interface SubstituteOptions {
  mode?: SubstituteMode;
  now?: Date;
}

export function buildVarMap(
  dbVars: ReadonlyArray<{ key: string; value: string | null }>,
  opts: SubstituteOptions = {},
): Map<string, string> {
  const m = presetVars(opts.now);
  for (const { key, value } of dbVars) {
    if (value && value.trim().length > 0) {
      m.set(key, value);
    }
  }
  return m;
}

/**
 * LEGAL-V2 — Wording standard pour vars marquées `sensitive=true` en mode public.
 * La valeur DB n'est PAS exposée — remplacée par une invitation contact email.
 *
 * Cf. docs/pages-legales-fix-2026-05/00-context/contraintes-juridiques.md
 */
export const SENSITIVE_VAR_PUBLIC_PLACEHOLDER =
  'information disponible sur demande à legal@femiglow-maroc.com';

/**
 * LEGAL-V2 — Construit le var map pour rendu public avec masquage des vars
 * sensibles. Pour les rows DB avec `sensitive=true`, la valeur est remplacée
 * par le placeholder standard (independent de la valeur réelle stockée).
 *
 * Utiliser cette variante au lieu de `buildVarMap` côté `/legal/*` public.
 * Côté admin preview, utiliser `buildVarMap` (qui expose les vraies valeurs).
 */
export function buildPublicVarMap(
  dbVars: ReadonlyArray<{ key: string; value: string | null; sensitive: boolean }>,
  opts: SubstituteOptions = {},
): Map<string, string> {
  const m = presetVars(opts.now);
  for (const { key, value, sensitive } of dbVars) {
    if (sensitive) {
      // Toujours remplacer par le placeholder, peu importe si value est rempli.
      m.set(key, SENSITIVE_VAR_PUBLIC_PLACEHOLDER);
    } else if (value && value.trim().length > 0) {
      m.set(key, value);
    }
  }
  return m;
}

export function substituteVars(
  md: string,
  vars: Map<string, string>,
  mode: SubstituteMode = 'public',
): string {
  return md.replace(VAR_PATTERN, (_full, rawKey: string) => {
    const value = vars.get(rawKey);
    if (value !== undefined) return value;
    if (mode === 'admin-preview') {
      // Marker textuel : un rehype plugin (rehypeHighlightMissingVars)
      // wrap ce pattern dans <mark data-missing-var> APRÈS le parse MD.
      // On évite d'injecter du HTML inline dans le source MD car
      // remarkRehype l'écraserait (allowDangerousHtml: false).
      return `⦉${rawKey}⦊`;
    }
    return `[${rawKey}]`;
  });
}

/** Délimiteurs du marker missing-var (Z notation brackets, peu probable
 * d'apparaître naturellement dans du contenu légal). */
export const MISSING_VAR_OPEN = '⦉';
export const MISSING_VAR_CLOSE = '⦊';
export const MISSING_VAR_REGEX = /⦉([A-Z][A-Z0-9_]*)⦊/g;

export function detectVarsInTemplate(md: string): string[] {
  const matches = md.matchAll(VAR_PATTERN);
  const seen = new Set<string>();
  for (const m of matches) seen.add(m[1]!);
  return [...seen];
}

export function detectMissingVars(
  md: string,
  dbVars: ReadonlyArray<{ key: string; value: string | null; isRequired: boolean }>,
): string[] {
  const used = detectVarsInTemplate(md);
  const byKey = new Map(dbVars.map((v) => [v.key, v]));
  const missing: string[] = [];
  for (const key of used) {
    if (isPresetVar(key)) continue;
    const v = byKey.get(key);
    if (!v) {
      missing.push(key);
      continue;
    }
    if (v.isRequired && (!v.value || v.value.trim().length === 0)) {
      missing.push(key);
    }
  }
  return missing;
}
