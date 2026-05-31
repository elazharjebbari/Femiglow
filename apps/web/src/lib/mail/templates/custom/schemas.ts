/**
 * Zod schemas API templates custom (M5.7.4-5).
 */
import { z } from 'zod';

const SlugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z][a-z0-9-]*$/, 'kebab-case');

export const CreateTemplateSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  subjectTmpl: z.string().min(1).max(300),
  preheaderTmpl: z.string().max(300).optional(),
  htmlSource: z.string().min(20).max(200_000),
  customVars: z.record(z.string(), z.unknown()).optional(),
});

export const SaveVersionSchema = z.object({
  subjectTmpl: z.string().min(1).max(300),
  preheaderTmpl: z.string().max(300).optional(),
  htmlSource: z.string().min(20).max(200_000),
  customVars: z.record(z.string(), z.unknown()).optional(),
  commitMessage: z.string().max(200).optional(),
});

export const PreviewTemplateSchema = z.object({
  subjectTmpl: z.string().optional(),
  preheaderTmpl: z.string().optional(),
  htmlSource: z.string().min(1).max(200_000),
  contextEmail: z.string().email().optional(),
  customVars: z.record(z.string(), z.unknown()).optional(),
});

export const TestSendSchema = z.object({
  recipient: z.string().email(),
  contextEmail: z.string().email().optional(),
});

export type CreateTemplateDto = z.infer<typeof CreateTemplateSchema>;
export type SaveVersionDto = z.infer<typeof SaveVersionSchema>;
export type PreviewTemplateDto = z.infer<typeof PreviewTemplateSchema>;
export type TestSendDto = z.infer<typeof TestSendSchema>;
