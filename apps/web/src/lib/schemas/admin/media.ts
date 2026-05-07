import { z } from 'zod';

export const mediaListFiltersSchema = z.object({
  q: z.string().optional(),
  kind: z.enum(['image', 'video', 'audio']).optional(),
  status: z.enum(['pending', 'processing', 'ready', 'failed', 'passthrough']).optional(),
  isHero: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  unused: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(['created_desc', 'created_asc', 'size_desc', 'most_used']).optional(),
});

export const mediaUpdateSchema = z.object({
  alt: z.string().min(1).max(500).optional(),
  caption: z.string().max(1000).nullish(),
  credit: z.string().max(200).nullish(),
  status: z.enum(['pending', 'processing', 'ready', 'failed', 'passthrough']).optional(),
  qualityProfile: z.enum(['hero', 'inline', 'thumb']).optional(),
  loadingStrategy: z.enum(['eager', 'viewport', 'idle', 'interaction']).optional(),
  isHero: z.boolean().optional(),
  overrides: z.record(z.unknown()).optional(),
});

export const mediaUploadSchema = z.object({
  kind: z.enum(['image', 'video', 'audio']),
  source: z.enum(['upload', 'external']).default('upload'),
  slug: z.string().min(1).max(120),
  alt: z.string().min(1).max(500),
  caption: z.string().max(1000).optional(),
  credit: z.string().max(200).optional(),
  qualityProfile: z.enum(['hero', 'inline', 'thumb']).optional(),
  loadingStrategy: z.enum(['eager', 'viewport', 'idle', 'interaction']).optional(),
  isHero: z.boolean().optional(),
  externalUrl: z.string().url().optional(),
});

export type MediaListFilters = z.infer<typeof mediaListFiltersSchema>;
export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;
export type MediaUploadMetadata = z.infer<typeof mediaUploadSchema>;
