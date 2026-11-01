import { z } from 'zod';

import { LEAD_SOURCE_CHANNELS, LEAD_SOURCE_KINDS } from '@/lib/leads/lead-source';

/** Un `<select>` « — Tous — » envoie une chaîne vide, qui n'est pas un filtre. */
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

export const leadStatusSchema = z.enum([
  'new',
  'contacted',
  'qualified',
  'converted',
  'lost',
  'archived',
]);

export const leadFiltersSchema = z.object({
  status: z.preprocess(emptyToUndefined, leadStatusSchema.optional()),
  search: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(120).optional()),
  channel: z.preprocess(emptyToUndefined, z.enum(LEAD_SOURCE_CHANNELS).optional()),
  kind: z.preprocess(emptyToUndefined, z.enum(LEAD_SOURCE_KINDS).optional()),
  period: z.enum(['7', '30', '90', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
  sort: z.enum(['created_desc', 'created_asc']).default('created_desc'),
});

export type LeadFiltersInput = z.infer<typeof leadFiltersSchema>;

export const leadStatusUpdateSchema = z.object({
  status: leadStatusSchema,
});

export const leadNoteSchema = z.object({
  content: z.string().trim().min(2, 'Note trop courte').max(2000, 'Note trop longue'),
});
