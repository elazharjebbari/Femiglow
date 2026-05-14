/**
 * Schemas Zod pour les configurations GTM versionnées.
 *
 * Une configuration regroupe les valeurs de variables (Pixel IDs,
 * Conv labels, etc.) **par environnement**. Les versions de
 * configurations sont stockées dans `tracking_settings`
 * (key = `gtm.config_versions`) — cf. docs/gtm/16-vars-config-and-viz.md.
 */

import { z } from 'zod';

export const GTM_PROVIDER_KINDS = [
  'google_ga4',
  'google_ads',
  'meta',
  'tiktok',
  'snap',
  'pinterest',
] as const;

export type GtmProviderKind = (typeof GTM_PROVIDER_KINDS)[number];

/* Regex tolérantes (les chaînes vides sont acceptées pour permettre
   « provider non configuré »). */
const ga4MeasurementId = z
  .string()
  .max(40)
  .regex(/^(G-[A-Z0-9]{6,12}|)$/, 'Format attendu : G-XXXXXXX');

const numericPixelId = z
  .string()
  .max(40)
  .regex(/^[0-9]{0,20}$/, 'Format attendu : nombre');

const opaqueId = z.string().max(80);

const adsCustomerId = z
  .string()
  .max(40)
  .regex(/^([0-9]{3}-[0-9]{3}-[0-9]{4}|[0-9]{10}|)$/, 'Format AW : 123-456-7890');

const adsConvLabel = z
  .string()
  .max(60)
  .regex(/^(AW-[A-Z0-9_-]+\/[A-Za-z0-9_-]+|)$/, 'Format AW-XXX/abc123');

const currency = z
  .string()
  .max(8)
  .regex(/^[A-Z]{3}$/, 'Code ISO 4217 (3 lettres) — ex. MAD');

const cookieDomain = z
  .string()
  .max(120)
  .regex(/^(auto|none|[a-z0-9.-]{2,}|)$/, 'Domaine cookie');

export const gtmEnvConfigSchema = z
  .object({
    ga4MeasurementId: ga4MeasurementId.default(''),
    metaPixelId: numericPixelId.default(''),
    tiktokPixelId: opaqueId.default(''),
    snapPixelId: opaqueId.default(''),
    pinterestTagId: numericPixelId.default(''),
    googleAdsCustomerId: adsCustomerId.default(''),
    googleAdsConvLabels: z
      .object({
        purchase: adsConvLabel.optional(),
        lead: adsConvLabel.optional(),
        signup: adsConvLabel.optional(),
        initCheckout: adsConvLabel.optional(),
      })
      .partial()
      .default({}),
    defaultCurrency: currency.default('MAD'),
    cookieDomain: cookieDomain.default('auto'),
    enabledProviders: z.array(z.enum(GTM_PROVIDER_KINDS)).default([]),
  })
  .strict();

export type GtmEnvConfigDTO = z.infer<typeof gtmEnvConfigSchema>;

export const GTM_ENVS = ['production', 'stage', 'preview', 'dev'] as const;
export type GtmEnv = (typeof GTM_ENVS)[number];

export const gtmConfigPerEnvSchema = z.object({
  production: gtmEnvConfigSchema,
  stage: gtmEnvConfigSchema,
  preview: gtmEnvConfigSchema,
  dev: gtmEnvConfigSchema,
});

export type GtmConfigPerEnv = z.infer<typeof gtmConfigPerEnvSchema>;

export const gtmConfigVersionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  notes: z.string().max(2000).nullable(),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1).max(120),
  perEnv: gtmConfigPerEnvSchema,
  // D-003 — édition de version GTM = clone (jamais d'in-place update).
  // Trace l'héritage pour l'audit trail et le diff UI.
  clonedFrom: z.string().uuid().nullable().optional(),
});

export type GtmConfigVersion = z.infer<typeof gtmConfigVersionSchema>;

/** Payload de création — pas d'id, pas d'auteur (déduit de la session).
 *
 * Le `superRefine` impose les règles cross-env documentées dans
 * docs/gtm/17-onboarding-robustness.md §3.6 :
 *  - GA4 activé en prod ⇒ ga4MeasurementId rempli
 *  - Conv labels prod ⇒ Ads Customer ID rempli
 *  - Pas de Pixel "DEV"/"SANDBOX" reconnu en production
 */
export const gtmConfigCreateInputSchema = z
  .object({
    name: z.string().min(1).max(120),
    notes: z.string().max(2000).nullable().optional(),
    perEnv: gtmConfigPerEnvSchema,
  })
  .superRefine((input, ctx) => {
    const prod = input.perEnv.production;
    const enabled = new Set(prod.enabledProviders ?? []);

    // Règle 1 : GA4 activé en prod ⇒ Measurement ID rempli
    if (enabled.has('google_ga4') && !prod.ga4MeasurementId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['perEnv', 'production', 'ga4MeasurementId'],
        message:
          'GA4 est activé en production mais le Measurement ID est vide. Renseigne G-XXXXXXX ou retire google_ga4 d’enabledProviders.',
      });
    }

    // Règle 2 : Conv labels prod sans Ads Customer ID
    const convLabels = prod.googleAdsConvLabels ?? {};
    const hasAnyLabel = Object.values(convLabels).some((v) => !!v);
    if (hasAnyLabel && !prod.googleAdsCustomerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['perEnv', 'production', 'googleAdsCustomerId'],
        message:
          'Des Conv labels sont définis mais l’Ads Customer ID est vide en production.',
      });
    }

    // Règle 3 : GA4 ID prod marqué DEV/TEST (heuristique anti-erreur).
    // (Pixel Meta est numérique, donc cette règle ne s'y applique pas.)
    const suspectMarkers = /(DEV|TEST)/i;
    if (prod.ga4MeasurementId && suspectMarkers.test(prod.ga4MeasurementId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['perEnv', 'production', 'ga4MeasurementId'],
        message:
          'Le Measurement ID GA4 de production semble être un identifiant DEV/TEST.',
      });
    }
  });

export type GtmConfigCreateInput = z.infer<typeof gtmConfigCreateInputSchema>;

export const gtmConfigStateSchema = z.object({
  activeId: z.string().uuid().nullable(),
  versions: z.array(gtmConfigVersionSchema).max(50),
});

export type GtmConfigState = z.infer<typeof gtmConfigStateSchema>;

export const GTM_CONFIG_VERSIONS_KEY = 'gtm.config_versions' as const;

export const MAX_CONFIG_VERSIONS = 50;

/** Defaults vides — utilisé pour pré-remplir le formulaire. */
export function emptyEnvConfig(): GtmEnvConfigDTO {
  return gtmEnvConfigSchema.parse({});
}

export function emptyConfigState(): GtmConfigState {
  return { activeId: null, versions: [] };
}
