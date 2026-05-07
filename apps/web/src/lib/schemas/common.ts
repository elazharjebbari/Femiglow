import { z } from 'zod';

export const imageSchema = z.object({
  src: z.string().url().or(z.string().startsWith('/')),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  blurDataURL: z.string().optional(),
});
export type Image = z.infer<typeof imageSchema>;

export const seoMetaSchema = z.object({
  title: z.string().min(1).max(70).optional(),
  description: z.string().min(1).max(160).optional(),
  keywords: z.array(z.string()).optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: imageSchema.optional(),
  noIndex: z.boolean().default(false),
});
export type SEOMeta = z.infer<typeof seoMetaSchema>;

export const ctaSchema = z.object({
  label: z.string().min(1),
  href: z.string(),
  variant: z.enum(['primary', 'secondary', 'ghost', 'link']).default('primary'),
});
export type CTA = z.infer<typeof ctaSchema>;

export const phoneMarocSchema = z
  .string()
  .regex(/^(\+212|0)[5-7][0-9]{8}$/, 'Le numéro doit commencer par +212 ou 0.');

export const emailSchema = z
  .string()
  .email('Cette adresse email semble incorrecte.');

export const postalCodeMarocSchema = z
  .string()
  .regex(/^[0-9]{5}$/, 'Code postal à 5 chiffres.');
