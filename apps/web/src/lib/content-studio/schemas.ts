import { z } from 'zod';
import {
  CONTENT_FORMATS,
  CONTENT_OBJECTIVES,
  CONTENT_PILLARS,
  CONTENT_PLATFORMS,
} from './types';

export const contentIdeaCreateSchema = z
  .object({
    campaignId: z.string().min(1).nullable().optional(),
    pillar: z.enum(CONTENT_PILLARS),
    objective: z.enum(CONTENT_OBJECTIVES),
    platform: z.enum(CONTENT_PLATFORMS),
    format: z.enum(CONTENT_FORMATS),
    prompt: z.string().min(8).max(2000),
    sourceType: z.string().max(80).nullable().optional(),
    sourceRef: z.string().max(160).nullable().optional(),
  })
  .strict();

export const draftUpdateSchema = z
  .object({
    caption: z.string().min(1).max(2200).optional(),
    hook: z.string().max(280).nullable().optional(),
    cta: z.string().max(160).nullable().optional(),
    altText: z.string().max(500).nullable().optional(),
    hashtags: z.array(z.string().min(1).max(80)).max(30).optional(),
    mediaId: z.string().min(1).nullable().optional(),
  })
  .strict();

export const postizDraftSchema = z
  .object({
    integrationId: z.string().min(1),
    scheduledAt: z.string().datetime().nullable().optional(),
    tags: z.array(z.object({ value: z.string(), label: z.string() }).strict()).max(20).optional(),
  })
  .strict();

export const visualGenerationSchema = z
  .object({
    prompt: z.string().min(12).max(1800),
    size: z.enum(['1024x1024', '1024x1536', '1536x1024']).default('1024x1536'),
    quality: z.enum(['low', 'medium', 'high']).default('low'),
  })
  .strict();
