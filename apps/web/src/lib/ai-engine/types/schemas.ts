import { z } from 'zod';
import {
  CONTENT_OBJECTIVES,
  CONTENT_PILLARS,
  CONTENT_PLATFORMS,
  CONTENT_FORMATS,
} from '@/lib/content-studio/types';

export const briefInputSchema = z.object({
  objective: z.enum(CONTENT_OBJECTIVES),
  tone: z.string().min(1),
  targetAudience: z.string().min(1),
  productFocus: z.string().optional(),
  keyMessage: z.string().min(1),
  constraints: z.record(z.unknown()).optional(),
  seasonalContext: z.string().optional(),
  trendReference: z.string().optional(),
  language: z.string().default('fr'),
  maxBudgetCents: z.number().int().nonnegative().optional(),
});

export type BriefInput = z.infer<typeof briefInputSchema>;

export const visualNoteSchema = z.object({
  description: z.string().min(1),
  style: z.string().optional(),
  camera: z.string().optional(),
  lighting: z.string().optional(),
  props: z.array(z.string()).optional(),
});

export type VisualNote = z.infer<typeof visualNoteSchema>;

export const sceneBlockSchema = z.object({
  sceneNumber: z.number().int().positive(),
  durationSeconds: z.number().positive(),
  narration: z.string().optional(),
  onScreenText: z.string().optional(),
  visualNote: visualNoteSchema,
  transition: z.string().optional(),
});

export type SceneBlock = z.infer<typeof sceneBlockSchema>;

export const scriptOutputSchema = z.object({
  hook: z.string().min(1),
  scenes: z.array(sceneBlockSchema).min(1),
  cta: z.string().min(1),
  voiceoverRequired: z.boolean(),
  musicRequired: z.boolean(),
  musicMood: z.string().optional(),
  visualDirection: z.array(z.string()),
  estimatedDurationSeconds: z.number().positive(),
});

export type ScriptOutput = z.infer<typeof scriptOutputSchema>;

export const captionOutputSchema = z.object({
  caption: z.string().min(1),
  hashtags: z.array(z.string()),
  ctaText: z.string().optional(),
});

export type CaptionOutput = z.infer<typeof captionOutputSchema>;

export const qualityScoreSchema = z.record(z.string(), z.number().min(0).max(100));

export type QualityScore = z.infer<typeof qualityScoreSchema>;

export const moderationResultSchema = z.object({
  safe: z.boolean(),
  flags: z.array(z.string()),
  canRetry: z.boolean(),
});

export type ModerationResult = z.infer<typeof moderationResultSchema>;

export const humanReviewSchema = z.object({
  decision: z.enum(['approved', 'approved_direct', 'rejected', 'edit_requested']),
  feedback: z.string().optional(),
});

export type HumanReview = z.infer<typeof humanReviewSchema>;

export const contentGenerationInputSchema = z.object({
  brief: briefInputSchema,
  platform: z.enum(CONTENT_PLATFORMS),
  format: z.enum(CONTENT_FORMATS),
  contentType: z.enum(CONTENT_PILLARS),
  tenantId: z.string().uuid(),
});

export type ContentGenerationInput = z.infer<typeof contentGenerationInputSchema>;
