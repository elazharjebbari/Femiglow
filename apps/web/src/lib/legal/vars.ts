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
  return key === 'LAST_UPDATED' || key === 'CURRENT_YEAR' || key === 'SITE_URL';
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

export function substituteVars(
  md: string,
  vars: Map<string, string>,
  mode: SubstituteMode = 'public',
): string {
  return md.replace(VAR_PATTERN, (_full, rawKey: string) => {
    const value = vars.get(rawKey);
    if (value !== undefined) return value;
    if (mode === 'admin-preview') {
      return `<mark data-missing-var="${rawKey}">{{${rawKey}}}</mark>`;
    }
    return `[${rawKey}]`;
  });
}

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
