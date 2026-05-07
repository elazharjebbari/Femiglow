import { z } from 'zod';
import { imageSchema, seoMetaSchema } from './common';

export const articleCategorySchema = z.enum([
  'maison',
  'saison',
  'voix',
  'matieres',
  'pratique',
]);
export type ArticleCategory = z.infer<typeof articleCategorySchema>;

export const articleAuthorSchema = z.object({
  name: z.string().min(1),
  bio: z.string().optional(),
  avatar: imageSchema.optional(),
});
export type ArticleAuthor = z.infer<typeof articleAuthorSchema>;

export const articleSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(120),
  kicker: z.string().optional(),
  excerpt: z.string().min(1).max(320),
  category: articleCategorySchema,
  readingTimeMinutes: z.number().int().positive().max(60),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  featuredImage: imageSchema,
  author: articleAuthorSchema,
  body: z.string(),
  isFeatured: z.boolean().default(false),
  wordCount: z.number().int().positive().optional(),
  seo: seoMetaSchema.default({}),
});
export type Article = z.infer<typeof articleSchema>;
