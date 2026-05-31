/**
 * DELIV-CITIES — Schémas Zod pour les payloads admin & search.
 *
 * Centralise la validation entrée d'API pour qu'elle soit réutilisée :
 *  - côté route admin (create/patch),
 *  - côté tests (génération de fixtures bien typés),
 *  - côté composant admin (resolver react-hook-form).
 *
 * Règles :
 *   - slug ASCII strict ; nameFr/nameAr trim non vides.
 *   - prix MAD entier >= 0 (PAS centimes — règle métier validée).
 *   - aliases : array de strings trimmés, dédup case-insensitive.
 */
import { z } from 'zod';

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const ETA_REGEX = /^[\p{L}\p{N}\s\-/.,:()'"–—h]+$/u;
const COUNTRY_REGEX = /^[A-Z]{2}$/;

export const deliveryCitySourceSchema = z.enum(['sendit', 'manual', 'custom']);
export type DeliveryCitySource = z.infer<typeof deliveryCitySourceSchema>;

const trimmedString = (max: number) =>
  z
    .string()
    .trim()
    .min(1, 'Champ obligatoire')
    .max(max, `Maximum ${max} caractères`);

export const deliveryCityCreateSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, 'Slug trop court')
    .max(80, 'Slug trop long')
    .regex(SLUG_REGEX, 'Slug invalide : a-z, 0-9, tirets uniquement'),
  nameFr: trimmedString(120),
  nameAr: z
    .string()
    .trim()
    .max(120, 'Maximum 120 caractères')
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  countryCode: z.string().regex(COUNTRY_REGEX, 'Code pays ISO 3166-1 alpha-2').default('MA'),
  deliveryPriceMad: z
    .number({ invalid_type_error: 'Prix doit être un nombre' })
    .int('Prix entier requis (PAS centimes)')
    .min(0, 'Prix négatif interdit')
    .max(10000, 'Prix anormalement élevé'),
  deliveryEta: z
    .string()
    .trim()
    .min(1, 'ETA obligatoire')
    .max(40, 'ETA trop long')
    .regex(ETA_REGEX, 'ETA contient des caractères non autorisés'),
  isActive: z.boolean().default(true),
  source: deliveryCitySourceSchema.default('manual'),
  externalRef: z.string().trim().max(80).nullable().optional(),
  aliases: z
    .array(z.string().trim().min(1).max(80))
    .default([])
    .transform((arr) => {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const a of arr) {
        const key = a.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(a);
        }
      }
      return out;
    }),
  metadata: z.record(z.string(), z.unknown()).default({}),
  position: z.number().int().min(0).max(100000).default(0),
});

export type DeliveryCityCreateInput = z.infer<typeof deliveryCityCreateSchema>;

export const deliveryCityPatchSchema = z.object({
  nameFr: trimmedString(120).optional(),
  nameAr: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v ? v : null)),
  deliveryPriceMad: z
    .number()
    .int('Prix entier requis (PAS centimes)')
    .min(0)
    .max(10000)
    .optional(),
  deliveryEta: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(ETA_REGEX)
    .optional(),
  isActive: z.boolean().optional(),
  aliases: z
    .array(z.string().trim().min(1).max(80))
    .optional()
    .transform((arr) => {
      if (!arr) return undefined;
      const seen = new Set<string>();
      const out: string[] = [];
      for (const a of arr) {
        const key = a.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push(a);
        }
      }
      return out;
    }),
  metadata: z.record(z.string(), z.unknown()).optional(),
  position: z.number().int().min(0).max(100000).optional(),
  source: deliveryCitySourceSchema.optional(),
});

export type DeliveryCityPatchInput = z.infer<typeof deliveryCityPatchSchema>;

export const deliveryCitySeedSchema = z.object({
  force: z.boolean().default(false),
  fixturePath: z.string().trim().min(1).max(500).optional(),
});

export type DeliveryCitySeedInput = z.infer<typeof deliveryCitySeedSchema>;

export const deliveryCityPositionsSchema = z.object({
  positions: z
    .array(
      z.object({
        slug: z.string().trim().min(1).max(80),
        position: z.number().int().min(0).max(100000),
      }),
    )
    .min(1)
    .max(100),
});

export type DeliveryCityPositionsInput = z.infer<typeof deliveryCityPositionsSchema>;

export const deliveryCitySearchQuerySchema = z.object({
  q: z.string().trim().max(80).optional().default(''),
  limit: z.coerce.number().int().min(1).max(50).optional().default(8),
  countryCode: z.string().regex(COUNTRY_REGEX).optional().default('MA'),
  includeInactive: z.coerce.boolean().optional().default(false),
});

export type DeliveryCitySearchQuery = z.infer<typeof deliveryCitySearchQuerySchema>;

export const deliveryCityListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  active: z.enum(['true', 'false', 'all']).optional().default('all'),
  source: z.enum(['sendit', 'manual', 'custom', 'all']).optional().default('all'),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(500).optional().default(50),
  sort: z.enum(['position', 'name', 'price', 'updated']).optional().default('position'),
});

export type DeliveryCityListQuery = z.infer<typeof deliveryCityListQuerySchema>;
