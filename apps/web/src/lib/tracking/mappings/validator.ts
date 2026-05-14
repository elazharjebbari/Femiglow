/**
 * Validation Zod par provider.
 * cf. docs/event-mappings/30-backend/validation-rules.md + ADR-004
 */
import { z } from 'zod';
import { PROVIDER_KINDS_FOR_MAPPING, type MappingProviderKind } from './types';

const META_NAME = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z][A-Za-z0-9_ ]{0,39}$/, "Meta : doit commencer par une lettre, alphanumérique + espace + underscore (40 chars max)");

const GA4_NAME = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[a-z][a-z0-9_]{0,39}$/, "GA4 : snake_case minuscule (40 chars max)");

const GOOGLE_ADS_NAME = z.string().min(1).max(60);
const TIKTOK_NAME = z.string().min(1).max(50);
const SNAP_NAME = z.string().min(1).max(50);
const PINTEREST_NAME = z.string().min(1).max(50);

const NAME_VALIDATOR: Record<MappingProviderKind, z.ZodTypeAny> = {
  meta: META_NAME,
  google_ga4: GA4_NAME,
  google_ads: GOOGLE_ADS_NAME,
  tiktok: TIKTOK_NAME,
  snap: SNAP_NAME,
  pinterest: PINTEREST_NAME,
};

export const mappingCellSchema = z
  .object({
    mappedName: z.string().nullable(),
    isCustom: z.boolean().default(false),
    isEnabled: z.boolean().default(true),
    notes: z.string().max(200).nullable().optional().default(null),
  })
  .strict();

export type MappingCellInput = z.input<typeof mappingCellSchema>;

export const mappingsByProviderSchema = z.object({
  meta: mappingCellSchema,
  google_ga4: mappingCellSchema,
  google_ads: mappingCellSchema,
  tiktok: mappingCellSchema,
  snap: mappingCellSchema,
  pinterest: mappingCellSchema,
});

export const mappingsSchema = z.record(z.string().min(1).max(80), mappingsByProviderSchema);

/**
 * Validation des règles métier par cellule (au-delà du shape Zod).
 * - Si mappedName != null → doit respecter la regex du provider.
 */
export function validateCell(
  cell: { mappedName: string | null },
  kind: MappingProviderKind,
): { ok: true } | { ok: false; error: string } {
  if (cell.mappedName === null) return { ok: true };
  const result = NAME_VALIDATOR[kind].safeParse(cell.mappedName);
  if (result.success) return { ok: true };
  const issue = result.error.issues[0];
  return { ok: false, error: issue?.message ?? 'mapping_name_invalid' };
}

/**
 * Valide une matrice entière. Retourne la liste des erreurs par chemin.
 */
export function validateMappings(mappings: unknown): {
  ok: boolean;
  errors: Array<{ path: string; message: string }>;
} {
  const parsed = mappingsSchema.safeParse(mappings);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    };
  }
  const errors: Array<{ path: string; message: string }> = [];
  for (const [eventName, providers] of Object.entries(parsed.data)) {
    for (const kind of PROVIDER_KINDS_FOR_MAPPING) {
      const cell = (providers as Record<string, { mappedName: string | null }>)[kind];
      if (!cell) continue;
      const v = validateCell(cell, kind);
      if (!v.ok) {
        errors.push({
          path: `${eventName}.${kind}.mappedName`,
          message: v.error,
        });
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
