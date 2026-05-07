/**
 * Templates de configuration GTM — pré-remplissages prédéfinis pour
 * l'onboarding rapide. Cf. docs/gtm/17-onboarding-robustness.md §3.1.
 *
 * Pas de Pixel ID réel ; les valeurs sont des placeholders sécurisés
 * que l'admin remplace ensuite.
 */

import { emptyEnvConfig, type GtmConfigPerEnv, type GtmEnvConfigDTO } from './config-schema';

export interface GtmTemplate {
  id: string;
  name: string;
  audience: 'maroc-ecommerce' | 'sandbox' | 'b2b-saas' | 'minimal';
  description: string;
  perEnv: GtmConfigPerEnv;
}

function withProviders(env: GtmEnvConfigDTO, providers: GtmEnvConfigDTO['enabledProviders']): GtmEnvConfigDTO {
  return { ...env, enabledProviders: providers };
}

const T_MAROC_ECOM: GtmTemplate = {
  id: 'maroc-ecommerce',
  name: 'E-commerce Maroc',
  audience: 'maroc-ecommerce',
  description:
    'B2C marocain : Currency MAD, GA4 + Meta + TikTok + Snap + Pinterest en prod, GA4 seul en stage/preview.',
  perEnv: {
    production: withProviders(
      {
        ...emptyEnvConfig(),
        defaultCurrency: 'MAD',
        cookieDomain: 'auto',
      },
      ['google_ga4', 'meta', 'tiktok', 'snap', 'pinterest', 'google_ads'],
    ),
    stage: withProviders(
      { ...emptyEnvConfig(), defaultCurrency: 'MAD' },
      ['google_ga4'],
    ),
    preview: withProviders(
      { ...emptyEnvConfig(), defaultCurrency: 'MAD' },
      ['google_ga4'],
    ),
    dev: { ...emptyEnvConfig(), defaultCurrency: 'MAD' },
  },
};

const T_SANDBOX: GtmTemplate = {
  id: 'sandbox',
  name: 'Sandbox / Tests',
  audience: 'sandbox',
  description:
    'Pour itérer en local sans toucher la production. Tous les envs en GA4 dev seul.',
  perEnv: {
    production: withProviders({ ...emptyEnvConfig() }, []),
    stage: withProviders({ ...emptyEnvConfig() }, []),
    preview: withProviders({ ...emptyEnvConfig() }, []),
    dev: withProviders(
      { ...emptyEnvConfig(), defaultCurrency: 'MAD' },
      ['google_ga4'],
    ),
  },
};

const T_B2B_SAAS: GtmTemplate = {
  id: 'b2b-saas',
  name: 'B2B SaaS / Lead-gen',
  audience: 'b2b-saas',
  description:
    'Currency EUR, focus lead conversions : GA4 + Meta + Google Ads en prod, GA4 seul en stage/preview.',
  perEnv: {
    production: withProviders(
      {
        ...emptyEnvConfig(),
        defaultCurrency: 'EUR',
        cookieDomain: 'auto',
      },
      ['google_ga4', 'meta', 'google_ads'],
    ),
    stage: withProviders(
      { ...emptyEnvConfig(), defaultCurrency: 'EUR' },
      ['google_ga4'],
    ),
    preview: withProviders(
      { ...emptyEnvConfig(), defaultCurrency: 'EUR' },
      ['google_ga4'],
    ),
    dev: { ...emptyEnvConfig(), defaultCurrency: 'EUR' },
  },
};

const T_MINIMAL: GtmTemplate = {
  id: 'minimal',
  name: 'Minimal',
  audience: 'minimal',
  description:
    'Démarrage progressif : GA4 seul en prod, autres envs vides. Ajoute les providers au fur et à mesure.',
  perEnv: {
    production: withProviders({ ...emptyEnvConfig() }, ['google_ga4']),
    stage: { ...emptyEnvConfig() },
    preview: { ...emptyEnvConfig() },
    dev: { ...emptyEnvConfig() },
  },
};

export const GTM_TEMPLATES: GtmTemplate[] = [
  T_MAROC_ECOM,
  T_SANDBOX,
  T_B2B_SAAS,
  T_MINIMAL,
];

export function findTemplate(id: string): GtmTemplate | null {
  return GTM_TEMPLATES.find((t) => t.id === id) ?? null;
}
