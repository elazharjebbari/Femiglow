import { z } from 'zod';

/** Map i18n libre { fr, ar, en, … } → chaînes. */
const i18nMap = z.record(z.string());

/** URL absolue ou chemin racine (`/stories/1.mp4`). */
const urlOrPath = z.string().min(1).max(2048);

export const storyInputSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'slug : minuscules, chiffres, tirets'),
  pageGroup: z.string().min(1).max(40).default('kit'),
  titleI18n: i18nMap.default({}),
  bubblePosterUrl: urlOrPath,
  accent: z.string().max(40).nullable().optional(),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type StoryInput = z.infer<typeof storyInputSchema>;

export const storyPatchSchema = storyInputSchema.partial().strict();
export type StoryPatch = z.infer<typeof storyPatchSchema>;

export const storySegmentInputSchema = z.object({
  videoUrl: urlOrPath,
  webmUrl: urlOrPath.nullable().optional(),
  posterUrl: urlOrPath,
  durationMs: z.number().int().min(0).default(0),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  captionI18n: i18nMap.default({}),
  ctaLabelI18n: i18nMap.default({}),
  ctaTarget: z.string().max(255).nullable().optional(),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});
export type StorySegmentInput = z.infer<typeof storySegmentInputSchema>;

export const storySegmentPatchSchema = storySegmentInputSchema.partial().strict();
export type StorySegmentPatch = z.infer<typeof storySegmentPatchSchema>;
