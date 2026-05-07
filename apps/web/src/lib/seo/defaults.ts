/**
 * Defaults SEO-CMS — valeurs par défaut codées pour `seo_settings`.
 * Servent de base à la cascade `resolveSeoMetadata()` et de filet de sécurité.
 */
import { FEMIGLOW_KNOWN_PAGES } from './known-pages';
import type { SeoSettings } from './types';

export const seoSettingsDefault: SeoSettings = {
  id: 'singleton',
  siteName: 'FemiGlow',
  defaultDescription:
    'FemiGlow — rituels intimes naturels conçus au Maroc. Soin, douceur et qualité.',
  defaultOgImageMediaId: null,
  twitterHandle: null,
  organizationJsonLd: {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'FemiGlow',
    url: 'https://femiglow.com',
  },
  defaultRobotsIndex: true,
  defaultRobotsFollow: true,
  knownPages: FEMIGLOW_KNOWN_PAGES,
  updatedAt: new Date(0),
  updatedBy: null,
};
