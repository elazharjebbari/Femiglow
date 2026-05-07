/**
 * Règles linter SEO — chaque règle prend un contexte et renvoie 0 ou 1 issue.
 * Pure CPU, pas d'effet ni fetch (sauf opt-in séparés non implémentés v1).
 *
 * cf. docs/seo-cms/frontend/02-seo-linter-audit.md
 */
import type { AuditCandidate, AuditIssue, AuditReport, RuleFn } from './types';

const TITLE_MAX = 60;
const TITLE_MIN = 30;
const DESC_MAX = 160;
const DESC_MIN = 80;
const KEYWORDS_MAX = 20;

const RULES: RuleFn[] = [
  // -- title -----------------------------------------------------------------
  ({ resolved }) =>
    !resolved.title || resolved.title.trim().length === 0
      ? {
          code: 'title.empty',
          severity: 'error',
          message: 'Le title est obligatoire.',
          field: 'title',
        }
      : null,
  ({ resolved }) =>
    resolved.title && resolved.title.length > TITLE_MAX
      ? {
          code: 'title.too-long',
          severity: 'warning',
          message: `Title ${resolved.title.length} chars (max ${TITLE_MAX}, sera tronqué en SERP).`,
          field: 'title',
        }
      : null,
  ({ resolved }) =>
    resolved.title && resolved.title.length > 0 && resolved.title.length < TITLE_MIN
      ? {
          code: 'title.too-short',
          severity: 'info',
          message: `Title ${resolved.title.length} chars (min ${TITLE_MIN} recommandé).`,
          field: 'title',
        }
      : null,

  // -- description ----------------------------------------------------------
  ({ resolved }) =>
    !resolved.description || resolved.description.trim().length === 0
      ? {
          code: 'description.empty',
          severity: 'error',
          message: 'La description est obligatoire.',
          field: 'description',
        }
      : null,
  ({ resolved }) =>
    resolved.description && resolved.description.length > DESC_MAX
      ? {
          code: 'description.too-long',
          severity: 'warning',
          message: `Description ${resolved.description.length} chars (max ${DESC_MAX}).`,
          field: 'description',
        }
      : null,
  ({ resolved }) =>
    resolved.description &&
    resolved.description.length > 0 &&
    resolved.description.length < DESC_MIN
      ? {
          code: 'description.too-short',
          severity: 'info',
          message: `Description ${resolved.description.length} chars (min ${DESC_MIN} recommandé).`,
          field: 'description',
        }
      : null,

  // -- keywords -------------------------------------------------------------
  ({ resolved }) =>
    Array.isArray(resolved.keywords) && resolved.keywords.length > KEYWORDS_MAX
      ? {
          code: 'keywords.too-many',
          severity: 'warning',
          message: `${resolved.keywords.length} keywords (max ${KEYWORDS_MAX}).`,
          field: 'keywords',
        }
      : null,

  // -- og image -------------------------------------------------------------
  ({ resolved }) =>
    !resolved.ogImageMediaId && !resolved.ogImageTemplate
      ? {
          code: 'og.image.missing',
          severity: 'warning',
          message: 'Aucune OG image (média ou template).',
          field: 'ogImageMediaId',
        }
      : null,

  // -- canonical ------------------------------------------------------------
  ({ resolved }) => {
    const c = resolved.canonical;
    if (!c) return null;
    if (!/^https?:\/\//.test(c)) {
      return {
        code: 'canonical.relative',
        severity: 'error',
        message: 'Canonical doit être une URL absolue (http/https).',
        field: 'canonical',
      };
    }
    try {
      const u = new URL(c);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return {
          code: 'canonical.protocol',
          severity: 'error',
          message: 'Canonical : protocole http/https requis.',
          field: 'canonical',
        };
      }
    } catch {
      return {
        code: 'canonical.relative',
        severity: 'error',
        message: 'Canonical URL invalide.',
        field: 'canonical',
      };
    }
    return null;
  },

  // -- jsonld ---------------------------------------------------------------
  ({ resolved }) => {
    const sd = resolved.structuredData;
    if (sd === null || sd === undefined) return null;
    if (typeof sd !== 'object') {
      return {
        code: 'jsonld.invalid',
        severity: 'error',
        message: 'JSON-LD doit être un objet.',
        field: 'structuredData',
      };
    }
    const ctx = (sd as Record<string, unknown>)['@context'];
    if (typeof ctx !== 'string' || !ctx.includes('schema.org')) {
      return {
        code: 'jsonld.invalid',
        severity: 'error',
        message: 'JSON-LD : @context doit référencer schema.org.',
        field: 'structuredData',
      };
    }
    const type = (sd as Record<string, unknown>)['@type'];
    if (type === undefined) {
      return {
        code: 'jsonld.unknown-type',
        severity: 'info',
        message: 'JSON-LD : @type absent.',
        field: 'structuredData',
      };
    }
    return null;
  },
];

export function runLinter(candidate: AuditCandidate): AuditReport {
  const issues: AuditIssue[] = [];
  for (const rule of RULES) {
    const issue = rule({ resolved: candidate });
    if (issue) issues.push(issue);
  }
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const info = issues.filter((i) => i.severity === 'info').length;
  const score = Math.max(0, 100 - errors * 25 - warnings * 8 - info * 2);
  return { score, issues, errors, warnings, info };
}

export type { AuditIssue, AuditReport, AuditCandidate, AuditSeverity } from './types';
