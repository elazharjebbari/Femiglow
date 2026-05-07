/**
 * Types SEO-CMS — modèles partagés.
 * cf. docs/seo-cms/architecture/02-data-model.md
 */

export type SeoScope = 'page' | 'component' | 'product' | 'article';
export type OgImageTemplate = 'marketing' | 'article' | 'product' | 'default';
export type TwitterCardType = 'summary' | 'summary_large_image';

export const SEO_SCOPES: readonly SeoScope[] = [
  'page',
  'component',
  'product',
  'article',
] as const;

export const OG_TEMPLATES: readonly OgImageTemplate[] = [
  'marketing',
  'article',
  'product',
  'default',
] as const;

export interface SeoOverride {
  id: string;
  scope: SeoScope;
  targetKey: string;
  locale: string;
  title: string | null;
  description: string | null;
  keywords: string[];
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageMediaId: string | null;
  ogImageTemplate: OgImageTemplate | null;
  twitterCard: TwitterCardType;
  canonical: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  structuredData: unknown;
  publishedAt: Date | null;
  draftedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}

export interface KnownPage {
  key: string;
  label: string;
  path: string;
  scope: SeoScope;
}

export interface SeoSettings {
  id: 'singleton';
  siteName: string;
  defaultDescription: string | null;
  defaultOgImageMediaId: string | null;
  twitterHandle: string | null;
  organizationJsonLd: unknown;
  defaultRobotsIndex: boolean;
  defaultRobotsFollow: boolean;
  knownPages: KnownPage[];
  updatedAt: Date;
  updatedBy: string | null;
}

export interface SeoAuditSnapshot {
  id: string;
  scope: SeoScope;
  targetKey: string;
  locale: string;
  capturedAt: Date;
  payload: unknown;
  actorId: string | null;
}

/**
 * Métadonnée SEO résolue pour le rendu (page, OG, twitter, JSON-LD).
 */
export interface ResolvedSeoMetadata {
  title: string;
  description: string;
  canonical: string | null;
  robots: { index: boolean; follow: boolean };
  og: {
    title: string;
    description: string;
    image: string | null;
    template: OgImageTemplate | null;
  };
  twitter: {
    card: TwitterCardType;
    handle: string | null;
  };
  keywords: string[];
  structuredData: unknown;
  source: 'override' | 'settings' | 'default';
}
