/**
 * Types — règles linter SEO + résultat audit.
 * cf. docs/seo-cms/frontend/02-seo-linter-audit.md
 */
import type { SeoOverride } from '@/lib/seo/types';

export type AuditSeverity = 'error' | 'warning' | 'info';

export interface AuditIssue {
  /** Code stable de la règle, ex: `title.too-long`. */
  code: string;
  severity: AuditSeverity;
  message: string;
  /** Champ formulaire concerné (sert au focus côté UI). */
  field?: string;
}

export interface AuditReport {
  score: number;
  issues: AuditIssue[];
  errors: number;
  warnings: number;
  info: number;
}

/**
 * Candidat audité — utilisé pour le mode "preview live" sans persister.
 * On accepte un Partial<SeoOverride> (l'éditeur peut envoyer juste les champs
 * modifiés) — le serveur fusionne avec l'existant.
 */
export type AuditCandidate = Partial<
  Pick<
    SeoOverride,
    | 'scope'
    | 'targetKey'
    | 'locale'
    | 'title'
    | 'description'
    | 'keywords'
    | 'ogTitle'
    | 'ogDescription'
    | 'ogImageMediaId'
    | 'ogImageTemplate'
    | 'twitterCard'
    | 'canonical'
    | 'robotsIndex'
    | 'robotsFollow'
    | 'structuredData'
  >
>;

export interface AuditContext {
  /** Override hydraté/résolu (après merge cascade). */
  resolved: AuditCandidate;
}

export type RuleFn = (ctx: AuditContext) => AuditIssue | null;
