import { z } from 'zod';

export const legalPageStatusSchema = z.enum(['draft', 'review', 'published', 'archived']);
export type LegalPageStatus = z.infer<typeof legalPageStatusSchema>;

export const legalLocaleSchema = z.enum(['fr-MA', 'ar-MA']);
export type LegalLocale = z.infer<typeof legalLocaleSchema>;

export const legalLinkStatusSchema = z.enum([
  'ok',
  'page_missing',
  'page_draft',
  'http_4xx',
  'http_5xx',
  'timeout',
]);
export type LegalLinkStatus = z.infer<typeof legalLinkStatusSchema>;

export const legalSlugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, digits, dashes');

export const legalZoneKeySchema = z
  .string()
  .min(2)
  .max(50)
  .regex(/^[a-z0-9-]+$/);

export const legalTemplateVarKeySchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[A-Z][A-Z0-9_]*$/);

export const legalPageSchema = z.object({
  id: z.string(),
  slug: legalSlugSchema,
  title: z.string().min(3).max(200),
  description: z.string().max(200).nullable(),
  bodyMd: z.string().min(10),
  status: legalPageStatusSchema,
  version: z.number().int().min(1),
  includeInSearch: z.boolean(),
  canonicalUrl: z.string().nullable(),
  locale: legalLocaleSchema,
  requireLegalReview: z.boolean(),
  lastLegalReviewAt: z.date().nullable(),
  lastLegalReviewBy: z.string().nullable(),
  submittedAt: z.date().nullable(),
  submittedBy: z.string().nullable(),
  publishedAt: z.date().nullable(),
  publishedBy: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
export type LegalPage = z.infer<typeof legalPageSchema>;

export const legalPageDraftInputSchema = z.object({
  slug: legalSlugSchema,
  title: z.string().min(3).max(200),
  description: z.string().max(200).optional().nullable(),
  bodyMd: z.string().min(10),
  includeInSearch: z.boolean().optional(),
  canonicalUrl: z.string().url().optional().nullable(),
  locale: legalLocaleSchema.optional(),
  requireLegalReview: z.boolean().optional(),
});
export type LegalPageDraftInput = z.infer<typeof legalPageDraftInputSchema>;

export const legalPageUpdateInputSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(200).optional().nullable(),
  bodyMd: z.string().min(10).optional(),
  includeInSearch: z.boolean().optional(),
  canonicalUrl: z.string().url().optional().nullable(),
  requireLegalReview: z.boolean().optional(),
});
export type LegalPageUpdateInput = z.infer<typeof legalPageUpdateInputSchema>;

export const legalPublishInputSchema = z.object({
  confirm: z.literal('PUBLIER'),
});
export type LegalPublishInput = z.infer<typeof legalPublishInputSchema>;

export const legalZoneSchema = z.object({
  key: legalZoneKeySchema,
  label: z.string().min(1),
  description: z.string().nullable(),
  maxItemsRecommended: z.number().int().min(1).max(20),
  isRequired: z.boolean(),
  displayOrder: z.number().int(),
  createdAt: z.date(),
});
export type LegalZone = z.infer<typeof legalZoneSchema>;

export const legalPlacementSchema = z.object({
  pageSlug: legalSlugSchema,
  zoneKey: legalZoneKeySchema,
  displayOrder: z.number().int(),
  isVisible: z.boolean(),
  labelOverride: z.string().min(1).max(80).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type LegalPlacement = z.infer<typeof legalPlacementSchema>;

export const legalPlacementInputSchema = z.object({
  pageSlug: legalSlugSchema,
  zoneKey: legalZoneKeySchema,
  displayOrder: z.number().int().optional(),
  isVisible: z.boolean().optional(),
  labelOverride: z.string().min(1).max(80).nullable().optional(),
});
export type LegalPlacementInput = z.infer<typeof legalPlacementInputSchema>;

export const legalTemplateVarSchema = z.object({
  key: legalTemplateVarKeySchema,
  value: z.string().max(1000).nullable(),
  label: z.string(),
  description: z.string().nullable(),
  isRequired: z.boolean(),
  sensitive: z.boolean(),
  updatedAt: z.date(),
  updatedBy: z.string().nullable(),
});
export type LegalTemplateVar = z.infer<typeof legalTemplateVarSchema>;

export const legalTemplateVarUpdateSchema = z.object({
  value: z.string().max(1000).nullable(),
});
export type LegalTemplateVarUpdateInput = z.infer<typeof legalTemplateVarUpdateSchema>;

export const legalLinkHealthRowSchema = z.object({
  zoneKey: legalZoneKeySchema,
  pageSlug: legalSlugSchema,
  status: legalLinkStatusSchema,
  httpCode: z.number().int().nullable(),
  latencyMs: z.number().int().nullable(),
  checkedAt: z.date(),
  notes: z.string().nullable(),
});
export type LegalLinkHealthRow = z.infer<typeof legalLinkHealthRowSchema>;

export const LEGAL_PAGE_ID_PREFIX = 'lp';
export const LEGAL_PAGE_HISTORY_ID_PREFIX = 'lph';
export const LEGAL_LINK_HEALTH_ID_PREFIX = 'llhs';
