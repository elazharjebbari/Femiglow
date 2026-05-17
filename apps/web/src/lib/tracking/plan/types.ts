import { z } from 'zod';

export const PROVIDER_IDS = ['ga4', 'googleAds', 'meta', 'tiktok', 'snap', 'gtm'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const ENV_NAMES = ['production', 'staging', 'local'] as const;
export type EnvName = (typeof ENV_NAMES)[number];

export const PLAN_STATUSES = ['draft', 'active', 'archived'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const AUDIT_ACTIONS = [
  'create',
  'update',
  'activate',
  'archive',
  'rollback',
  'delete',
  'restore',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const providerSchema = z.object({
  id: z.enum(PROVIDER_IDS),
  active: z.boolean(),
});
export type Provider = z.infer<typeof providerSchema>;

// Stocke un mapping `conversionLabelKey` → label Google Ads, ex.
//   { checkout_intent: "UGxLCMGJv6wcEMrHichD", lead: "...", purchase: "..." }
// La clé est définie côté code dans `event-mapping.ts`
// (`google_ads.conversionLabelKey`). Permet à un même conteneur GTM
// d'avoir N conversions Google Ads distinctes, chacune pilotée par
// l'event canonique correspondant.
export const googleAdsConversionLabelsSchema = z.record(z.string(), z.string());
export type GoogleAdsConversionLabels = z.infer<typeof googleAdsConversionLabelsSchema>;

export const envConfigSchema = z
  .object({
    ga4MeasurementId: z.string().optional(),
    googleAdsConversionId: z.string().optional(),
    /** @deprecated — utilisé seulement par les builds legacy. Remplacé
     *  par `googleAdsConversionLabels` (par-event). */
    googleAdsConversionLabel: z.string().optional(),
    googleAdsConversionLabels: googleAdsConversionLabelsSchema.optional(),
    /**
     * Active Enhanced Conversions pour Google Ads. Quand true, le
     * tag awct lit user_data du dataLayer (sha256 email/phone) pour
     * améliorer le matching post-clic. Recommandé : true (~5-30% de
     * conversions matchées en plus). Cf.
     * https://support.google.com/google-ads/answer/13262500
     */
    googleAdsEnhancedConversions: z.boolean().optional(),
    metaPixelId: z.string().optional(),
    tiktokPixelId: z.string().optional(),
    snapPixelId: z.string().optional(),
    snapAdvancedMatching: z.boolean().optional(),
    snapEventMode: z.enum(['pixel_only', 'capi_only', 'hybrid']).optional(),
    gtmContainerId: z.string().optional(),
  })
  // Catchall : autorise des clés arbitraires (string, record string,
  // boolean). Sans union, l'index signature serait restrictif et les
  // champs typés `googleAdsConversionLabels` (Record),
  // `googleAdsEnhancedConversions` (boolean) seraient rejetés.
  .catchall(
    z
      .union([z.string(), z.boolean(), googleAdsConversionLabelsSchema])
      .optional(),
  );
export type EnvConfig = z.infer<typeof envConfigSchema>;

export const envProfileSchema = z.object({
  env: z.enum(ENV_NAMES),
  config: envConfigSchema,
});
export type EnvProfile = z.infer<typeof envProfileSchema>;

export const eventSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, 'event key doit être snake_case ASCII'),
  label: z.string().max(120).optional(),
  providers: z.record(z.enum(PROVIDER_IDS), z.boolean()),
  params: z.record(z.string(), z.unknown()).optional(),
});
export type TrackingEvent = z.infer<typeof eventSchema>;

export const consentDefaultsSchema = z.object({
  ad_storage: z.enum(['granted', 'denied']).default('denied'),
  analytics_storage: z.enum(['granted', 'denied']).default('denied'),
  ad_user_data: z.enum(['granted', 'denied']).optional(),
  ad_personalization: z.enum(['granted', 'denied']).optional(),
});

export const settingsSchema = z
  .object({
    consentMode: z.enum(['v1', 'v2']).default('v2'),
    consentDefaults: consentDefaultsSchema.optional(),
  })
  .partial();
export type PlanSettings = z.infer<typeof settingsSchema>;

export const trackingPlanCoreSchema = z.object({
  name: z.string().min(1).max(120),
  status: z.enum(PLAN_STATUSES).default('draft'),
  version: z.number().int().min(1).default(1),
  providers: z.array(providerSchema).min(1),
  envProfiles: z.array(envProfileSchema).min(1),
  events: z.array(eventSchema),
  settings: settingsSchema.default({}),
});

export const trackingPlanSchema = trackingPlanCoreSchema.extend({
  id: z.string(),
  createdBy: z.string().email(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type TrackingPlan = z.infer<typeof trackingPlanSchema>;

export const trackingPlanInputSchema = trackingPlanCoreSchema.partial({
  status: true,
  version: true,
  settings: true,
});
export type TrackingPlanInput = z.infer<typeof trackingPlanInputSchema>;

export const auditEntrySchema = z.object({
  id: z.string(),
  planId: z.string(),
  action: z.enum(AUDIT_ACTIONS),
  actorEmail: z.string().email(),
  meta: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.coerce.date(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const validationIssueSchema = z.object({
  code: z.string(),
  path: z.string().optional(),
  message: z.string(),
  severity: z.enum(['error', 'warning', 'info']),
});
export type ValidationIssue = z.infer<typeof validationIssueSchema>;

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  ok: boolean;
}

export interface ExportResult {
  json: Record<string, unknown>;
  bundleId: string;
  exportedAt: Date;
}
