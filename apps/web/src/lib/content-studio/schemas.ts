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
    /** CS v2 create-audit Phase 2 — optional text-model override. Persisted only
     * in `content_generation_run.model`; not on the idea row itself. */
    model: z.string().min(1).max(120).optional(),
  })
  .strict();

/** CS v2 create-audit Phase 2 — body for POST /ideas/:id/generate. Allows the
 * UI to override the text-generation model just for this run. */
export const ideasGenerateSchema = z
  .object({
    model: z.string().min(1).max(120).optional(),
  })
  .strict()
  .optional();

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
    /** CS v2 Phase 3 — choose image vs video. Default keeps legacy callers working. */
    kind: z.enum(['image', 'video']).default('image'),
    /** CS v2 Phase 3 — optional image or video model id override. */
    model: z.string().min(1).max(120).optional(),
  })
  .strict();

// MP-VO-04 (BUG-004) — voice-over generation payload. `script` optional so the
// server derives narration from the draft; an explicit empty string is rejected
// by `.min(1)`. `.strict()` rejects stray keys.
export const voiceoverGenerationSchema = z
  .object({
    script: z.string().trim().min(1).max(4000).optional(),
    voice: z.enum(['mock', 'nova', 'alloy', 'shimmer', 'bella']).default('mock'),
  })
  .strict();

export const draftRejectSchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict();

export const postCancelSchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict();

export const postRescheduleSchema = z
  .object({
    scheduledAt: z.string().datetime(),
  })
  .strict();

export const draftVariationSchema = z
  .object({
    variantLabel: z.string().min(1).max(100).optional(),
    promptOverride: z.string().max(2000).optional(),
  })
  .strict();

export const archiveSchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict();

export const briefUpdateSchema = z
  .object({
    angle: z.string().max(500).optional(),
    proof: z.string().max(1000).optional(),
    cta: z.string().max(200).optional(),
    mediaDirection: z.string().max(500).optional(),
    constraints: z.record(z.unknown()).optional(),
  })
  .strict();

export const learningNoteSchema = z
  .object({
    postId: z.string().nullable().optional(),
    note: z.string().min(1).max(2000),
    tags: z.array(z.string()).max(5).optional(),
  })
  .strict();

export const campaignCreateSchema = z
  .object({
    name: z.string().min(1).max(200),
    objective: z.string().min(1).max(500),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export const campaignUpdateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    objective: z.string().min(1).max(500).optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export const campaignQuerySchema = z
  .object({
    status: z.enum(['draft', 'active', 'archived']).optional(),
  })
  .partial();

export const ideaQuerySchema = z
  .object({
    status: z.string().optional(),
    pillar: z.string().optional(),
    platform: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
  })
  .partial();

export const draftQuerySchema = z
  .object({
    status: z.string().optional(),
    platform: z.string().optional(),
    format: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
  })
  .partial();

export const postQuerySchema = z
  .object({
    status: z.string().optional(),
    scheduledAfter: z.string().optional(),
    scheduledBefore: z.string().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
  })
  .partial();
