/**
 * Resolver SEO — cascade defaults app → seo_settings → seo_overrides (publié).
 * Wrappé dans `unstable_cache` avec tag `seo`. Failsafe : si le payload DB
 * est invalide on retombe sur les defaults TS.
 */
import { unstable_cache } from 'next/cache';
import { logger } from '@/lib/logging/logger';
import {
  getOverrideByTarget,
  getSeoSettings,
} from '@/lib/db/queries/seo';
import { seoSettingsDefault } from './defaults';
import type { ResolvedSeoMetadata, SeoOverride, SeoScope } from './types';

export const SEO_TAG = 'seo';
export const seoTargetTag = (scope: SeoScope, targetKey: string) =>
  `seo:${scope}:${targetKey}`;

interface ResolveOptions {
  scope: SeoScope;
  targetKey: string;
  locale?: string;
  /** Si fourni, sert de fallback si l'override n'existe pas (ex: titre de la page hardcodé). */
  fallback?: { title?: string; description?: string };
}

function pickTitle(o: SeoOverride | null, fallback: ResolveOptions['fallback']): string {
  return o?.title || fallback?.title || seoSettingsDefault.siteName;
}

function pickDescription(
  o: SeoOverride | null,
  settingsDescription: string | null,
  fallback: ResolveOptions['fallback'],
): string {
  return (
    o?.description || fallback?.description || settingsDescription || seoSettingsDefault.defaultDescription || ''
  );
}

async function resolveUncached(opts: ResolveOptions): Promise<ResolvedSeoMetadata> {
  const locale = opts.locale ?? 'fr-MA';
  let override: SeoOverride | null = null;
  try {
    override = await getOverrideByTarget(opts.scope, opts.targetKey, locale);
    if (override && override.publishedAt === null) {
      // override draft only — on n'utilise pas les drafts pour le rendu public
      override = null;
    }
  } catch (err) {
    logger.warn('seo.override_lookup_failed', {
      scope: opts.scope,
      targetKey: opts.targetKey,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  let settings;
  try {
    settings = await getSeoSettings();
  } catch (err) {
    logger.warn('seo.settings_lookup_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    settings = seoSettingsDefault;
  }

  const title = pickTitle(override, opts.fallback);
  const description = pickDescription(override, settings.defaultDescription, opts.fallback);

  return {
    title,
    description,
    canonical: override?.canonical ?? null,
    robots: {
      index: override?.robotsIndex ?? settings.defaultRobotsIndex,
      follow: override?.robotsFollow ?? settings.defaultRobotsFollow,
    },
    og: {
      title: override?.ogTitle || title,
      description: override?.ogDescription || description,
      image: override?.ogImageMediaId ?? settings.defaultOgImageMediaId,
      template: override?.ogImageTemplate ?? null,
    },
    twitter: {
      card: override?.twitterCard ?? 'summary_large_image',
      handle: settings.twitterHandle,
    },
    keywords: override?.keywords ?? [],
    structuredData: override?.structuredData ?? settings.organizationJsonLd ?? null,
    source: override ? 'override' : settings.id === 'singleton' ? 'settings' : 'default',
  };
}

export async function resolveSeoMetadata(
  opts: ResolveOptions,
): Promise<ResolvedSeoMetadata> {
  const cached = unstable_cache(
    async () => resolveUncached(opts),
    ['seo', opts.scope, opts.targetKey, opts.locale ?? 'fr-MA'],
    { tags: [SEO_TAG, seoTargetTag(opts.scope, opts.targetKey)] },
  );
  return cached();
}
