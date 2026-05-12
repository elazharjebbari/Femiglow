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
    'FemiGlow \u2014 maison de soin pour les ongles \u00E9dit\u00E9e \u00E0 Rabat. Manucure japonaise halal, deux gestes et un polissoir.',
  defaultOgImageMediaId: null,
  twitterHandle: null,
  organizationJsonLd: {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'FemiGlow',
    url: 'https://femiglow-maroc.com',
  },
  defaultRobotsIndex: true,
  defaultRobotsFollow: true,
  knownPages: FEMIGLOW_KNOWN_PAGES,
  updatedAt: new Date(0),
  updatedBy: null,
};
