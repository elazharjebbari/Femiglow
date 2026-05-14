/**
 * Zod schemas API audience CRUD (M5.3.6).
 */
import { z } from 'zod';
import { ExclusionFlagsSchema, RulesGroupSchema } from './rules-types';

const SlugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z][a-z0-9-]*$/, 'slug must be lowercase kebab-case');

export const CreateAudienceSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  rules: RulesGroupSchema,
  exclusionFlags: ExclusionFlagsSchema.optional(),
  evaluationMode: z.enum(['static', 'dynamic']).optional(),
});

export const UpdateAudienceSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional(),
  rules: RulesGroupSchema.optional(),
  exclusionFlags: ExclusionFlagsSchema.optional(),
  evaluationMode: z.enum(['static', 'dynamic']).optional(),
});

export const PreviewSchema = z.object({
  rules: RulesGroupSchema,
  exclusionFlags: ExclusionFlagsSchema.optional(),
});

export const PreviewSampleSchema = PreviewSchema.extend({
  limit: z.number().int().min(1).max(50).optional(),
});

export const SnapshotTriggerSchema = z.object({
  snapshotKey: z.string().min(1).max(120).optional(),
  source: z.enum(['manual', 'campaign', 'automation']).optional(),
  campaignId: z.string().optional(),
});

export type CreateAudienceDto = z.infer<typeof CreateAudienceSchema>;
export type UpdateAudienceDto = z.infer<typeof UpdateAudienceSchema>;
export type PreviewDto = z.infer<typeof PreviewSchema>;
export type PreviewSampleDto = z.infer<typeof PreviewSampleSchema>;
export type SnapshotTriggerDto = z.infer<typeof SnapshotTriggerSchema>;
