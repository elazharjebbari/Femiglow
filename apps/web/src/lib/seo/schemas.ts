/**
 * Schémas Zod SEO-CMS — validation overrides + settings + JSON-LD.
 * cf. docs/seo-cms/backend/02-zod-validation.md
 */
import { z } from 'zod';

export const seoScopeEnum = z.enum(['page', 'component', 'product', 'article']);
export const ogImageTemplateEnum = z.enum(['marketing', 'article', 'product', 'default']);
export const twitterCardEnum = z.enum(['summary', 'summary_large_image']);

const ABS_URL = z
  .string()
  .url('URL absolue requise.')
  .refine((v) => /^https?:\/\//.test(v), 'URL doit commencer par http(s)://');

const TARGET_KEY = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9:_-]*$/, 'Clé invalide (a-z, 0-9, ":_-").');

const LOCALE = z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Locale invalide (ex: fr-MA).');

export const seoOverrideUpsertSchema = z
  .object({
    scope: seoScopeEnum,
    targetKey: TARGET_KEY,
    locale: LOCALE.default('fr-MA'),
    title: z.string().min(1).max(120).nullable().optional(),
    description: z.string().min(1).max(320).nullable().optional(),
    keywords: z.array(z.string().min(1).max(40)).max(20).default([]),
    ogTitle: z.string().min(1).max(120).nullable().optional(),
    ogDescription: z.string().min(1).max(320).nullable().optional(),
    ogImageMediaId: z.string().nullable().optional(),
    ogImageTemplate: ogImageTemplateEnum.nullable().optional(),
    twitterCard: twitterCardEnum.default('summary_large_image'),
    canonical: ABS_URL.nullable().optional(),
    robotsIndex: z.boolean().default(true),
    robotsFollow: z.boolean().default(true),
    structuredData: z.unknown().nullable().optional(),
  })
  .strict();

export const seoOverridePatchSchema = seoOverrideUpsertSchema.partial();

export const knownPageSchema = z
  .object({
    key: z
      .string()
      .min(1)
      .max(60)
      .regex(/^[a-z][a-z0-9-]*$/, 'Clé invalide (kebab-case).'),
    label: z.string().min(1).max(80),
    path: z.string().regex(/^\/[A-Za-z0-9/_-]*$/, 'Chemin doit commencer par /.'),
    scope: z.literal('page'),
  })
  .strict();

export const organizationJsonLdSchema = z
  .object({
    '@context': z.literal('https://schema.org'),
    '@type': z.literal('Organization'),
    name: z.string().min(1),
    url: ABS_URL.optional(),
    logo: ABS_URL.optional(),
    sameAs: z.array(ABS_URL).max(20).optional(),
  })
  .passthrough();

export const seoSettingsUpsertSchema = z
  .object({
    siteName: z.string().min(1).max(80),
    defaultDescription: z.string().min(1).max(320).nullable(),
    defaultOgImageMediaId: z.string().nullable(),
    twitterHandle: z
      .string()
      .regex(/^@[A-Za-z0-9_]{1,15}$/, 'Handle Twitter (préfixé @).')
      .nullable(),
    organizationJsonLd: organizationJsonLdSchema.nullable(),
    defaultRobotsIndex: z.boolean(),
    defaultRobotsFollow: z.boolean(),
    knownPages: z.array(knownPageSchema).max(100),
  })
  .strict();

export type SeoOverrideUpsert = z.infer<typeof seoOverrideUpsertSchema>;
export type SeoOverridePatch = z.infer<typeof seoOverridePatchSchema>;
export type SeoSettingsUpsert = z.infer<typeof seoSettingsUpsertSchema>;
