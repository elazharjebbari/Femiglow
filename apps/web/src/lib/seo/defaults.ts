/**
 * Defaults SEO-CMS — valeurs par défaut codées pour `seo_settings`.
 * Servent de base à la cascade `resolveSeoMetadata()` et de filet de sécurité
 * quand la table `seo_settings` est vide ou que la base est indisponible.
 *
 * Ces valeurs sont également utilisées par :
 *  - `lib/seo/seed.ts::seedSeoDefaults()` pour initialiser la DB au premier
 *    déploiement (idempotent — n'écrase pas une config existante).
 *  - `lib/seo/seed.ts::resetSeoSettingsToDefaults()` quand l'admin clique
 *    « Restaurer les paramètres par défaut » dans `/admin/seo/settings`.
 *  - Le script CLI `pnpm seed:seo`.
 *
 * Important : l'objet `seoSettingsDefault` est figé (`Object.freeze`) pour
 * empêcher toute mutation accidentelle côté consommateur. Pour obtenir une
 * copie modifiable, passer par `getSeoSettingsDefault()`.
 */
import { FEMIGLOW_KNOWN_PAGES } from './known-pages';
import type { SeoSettings } from './types';

/**
 * Organization JSON-LD canonique de la maison.
 *
 * Enrichi (logo, address, founder, contactPoint, sameAs) pour que Google
 * puisse construire un knowledge panel propre et que les autres pages héritent
 * d'un fallback de qualité quand aucun override `structuredData` n'est défini.
 *
 * Si tu modifies cet objet, exécute `pnpm seed:seo --reset` en staging pour
 * propager les changements en DB, puis valide via Rich Results Test sur
 * https://femiglow.ma/.
 */
export const FEMIGLOW_ORGANIZATION_JSON_LD = Object.freeze({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'FemiGlow',
  alternateName: 'Maison FemiGlow',
  url: 'https://femiglow.ma',
  logo: 'https://femiglow.ma/brand/femiglow-logo.png',
  description:
    'Maison de soin pour les ongles éditée au Maroc. Rituel de manucure japonaise halal en quatre gestes.',
  founder: {
    '@type': 'Person',
    name: 'Yasmine Jebbari',
  },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Casablanca',
    addressCountry: 'MA',
  },
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      areaServed: 'MA',
      availableLanguage: ['fr', 'ar'],
    },
  ],
  sameAs: [
    'https://www.instagram.com/femiglow',
    'https://www.tiktok.com/@femiglow',
  ],
}) as const;

/**
 * Valeurs par défaut figées de `seo_settings`. **Ne pas muter.**
 * Pour obtenir une copie modifiable (formulaire admin, payload d'upsert),
 * utilise `getSeoSettingsDefault()`.
 */
export const seoSettingsDefault: SeoSettings = Object.freeze({
  id: 'singleton',
  siteName: 'FemiGlow',
  defaultDescription:
    'FemiGlow — maison de soin pour les ongles éditée à Casablanca. Manucure japonaise halal en quatre gestes : pâte, poudre, brillance, polissage.',
  defaultOgImageMediaId: null,
  twitterHandle: null,
  organizationJsonLd: FEMIGLOW_ORGANIZATION_JSON_LD,
  defaultRobotsIndex: true,
  defaultRobotsFollow: true,
  knownPages: FEMIGLOW_KNOWN_PAGES,
  updatedAt: new Date(0),
  updatedBy: null,
}) as SeoSettings;

/**
 * Retourne une **copie profonde** des defaults SEO.
 *
 * À utiliser dans tout contexte mutateur (form admin pré-rempli, payload
 * d'upsert vers la DB) pour éviter de partager la référence figée et de
 * casser un autre consommateur.
 *
 * `updatedAt` est ré-évalué à `new Date(0)` (epoch) pour signaler explicitement
 * qu'il s'agit d'un objet par-défaut non encore persisté.
 */
export function getSeoSettingsDefault(): SeoSettings {
  return {
    id: 'singleton',
    siteName: seoSettingsDefault.siteName,
    defaultDescription: seoSettingsDefault.defaultDescription,
    defaultOgImageMediaId: seoSettingsDefault.defaultOgImageMediaId,
    twitterHandle: seoSettingsDefault.twitterHandle,
    organizationJsonLd: JSON.parse(JSON.stringify(seoSettingsDefault.organizationJsonLd)),
    defaultRobotsIndex: seoSettingsDefault.defaultRobotsIndex,
    defaultRobotsFollow: seoSettingsDefault.defaultRobotsFollow,
    knownPages: seoSettingsDefault.knownPages.map((p) => ({ ...p })),
    updatedAt: new Date(0),
    updatedBy: null,
  };
}
