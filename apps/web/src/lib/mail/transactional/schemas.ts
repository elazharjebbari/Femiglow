/**
 * Zod schemas partagés client/serveur pour les endpoints transactional cockpit.
 *
 * Validation aux frontières + types inférés pour les server actions.
 */
import { z } from 'zod';
import { OUTBOX_STATUSES } from './filters-parser';

const ParsedFilterSchema = z.discriminatedUnion('key', [
  z.object({
    key: z.literal('status'),
    value: z.array(z.enum(OUTBOX_STATUSES)).min(1),
    raw: z.string(),
  }),
  z.object({ key: z.literal('to'), value: z.string().min(1), raw: z.string() }),
  z.object({ key: z.literal('template'), value: z.string().min(1), raw: z.string() }),
  z.object({ key: z.literal('source'), value: z.string().min(1), raw: z.string() }),
  z.object({
    key: z.literal('after'),
    value: z.coerce.date(),
    raw: z.string(),
  }),
  z.object({
    key: z.literal('before'),
    value: z.coerce.date(),
    raw: z.string(),
  }),
  z.object({
    key: z.literal('attempts'),
    operator: z.enum(['>', '<', '>=', '<=', '=']),
    value: z.number().int().min(0).max(99),
    raw: z.string(),
  }),
  z.object({ key: z.literal('has'), value: z.literal('error'), raw: z.string() }),
]);

export const SearchInputSchema = z.object({
  filters: z.array(ParsedFilterSchema).max(20),
  freetext: z.string().max(200).optional(),
  pagination: z.object({
    limit: z.number().int().min(1).max(1000),
    offset: z.number().int().min(0),
  }),
  sort: z.enum(['date_desc', 'date_asc', 'status', 'template', 'attempts_desc']).optional(),
});

export const SummaryQuerySchema = z.object({
  window: z.enum(['1h', '24h', '7d', '30d']),
});

/**
 * Validateur d'id outbox.
 *
 * BUG FIX (Phase 6 E2E, chantier D) : `email_outbox.id` est un `text` généré par
 * `createId('out')` → forme `out_<nanoid base36>` (ex. `out_cvo1b6hlag15slhq`),
 * et JAMAIS un UUID. L'ancien `z.string().uuid()` rejetait donc TOUS les ids
 * réels (422 « Validation échouée ») ⇒ le bulk retry / suppress du cockpit était
 * inopérant en production. On valide ici un id opaque sûr : non vide, borné, et
 * limité aux caractères des ids applicatifs (alphanum + `_` + `-`). Ce jeu de
 * caractères couvre aussi le format UUID (compat ascendante des anciens tests
 * qui passaient un UUID), tout en rejetant les valeurs manifestement invalides.
 */
const OutboxIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'identifiant outbox invalide');

export const BulkRetrySchema = z.object({
  ids: z.array(OutboxIdSchema).min(0).max(500),
});

export const BulkSuppressSchema = z.object({
  ids: z.array(OutboxIdSchema).min(0).max(500),
  reason: z.enum(['manual_admin', 'hard_bounce']).optional(),
});

// — Saved views CRUD —————————————————————————————————————————————

const FilterStateSchema = z.object({
  filters: z.record(z.string(), z.unknown()).optional(),
  sort: z.string().optional(),
  cols: z.array(z.string()).optional(),
});

export const SavedViewScopeSchema = z.enum(['transactional', 'campaigns', 'automation']);

export const CreateViewSchema = z.object({
  name: z.string().min(1).max(80),
  scope: SavedViewScopeSchema,
  filterState: FilterStateSchema,
});

export const UpdateViewSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  filterState: FilterStateSchema.optional(),
});

export type SearchInputDto = z.infer<typeof SearchInputSchema>;
export type BulkRetryDto = z.infer<typeof BulkRetrySchema>;
export type BulkSuppressDto = z.infer<typeof BulkSuppressSchema>;
export type CreateViewDto = z.infer<typeof CreateViewSchema>;
export type UpdateViewDto = z.infer<typeof UpdateViewSchema>;
