import { z } from 'zod';

export const leadStatusSchema = z.enum([
  'new',
  'contacted',
  'qualified',
  'converted',
  'lost',
  'archived',
]);

export const leadFiltersSchema = z.object({
  status: leadStatusSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
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
