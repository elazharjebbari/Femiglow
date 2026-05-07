/**
 * Schémas Zod Admin-Config — source de vérité pour la validation des sections.
 * cf. docs/admin-config/backend/02-zod-validation.md
 */
import { z } from 'zod';
import type {
  BrandingConfig,
  FlagsConfig,
  NavConfig,
  RbacConfig,
  Section,
} from './types';

const KEY_REGEX = /^[a-z][a-z0-9-]*$/;

const ROLE_KEY = z.string().regex(KEY_REGEX, 'Clé de rôle invalide (kebab-case attendu).');
const FLAG_KEY = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Clé de flag invalide.');
const HEX_COLOR = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale 6 caractères attendue (#RRGGBB).');

export const RBAC_RESOURCES = [
  'components',
  'seo',
  'products',
  'media',
  'users',
  'app-config',
] as const satisfies readonly string[];

export const RBAC_ACTIONS = [
  'read',
  'write',
  'publish',
  'delete',
] as const satisfies readonly string[];

export const FONT_WHITELIST = ['Inter', 'Cormorant Garamond', 'Manrope'] as const;

export const navItemSchema = z
  .object({
    key: z.string().regex(KEY_REGEX, 'Clé invalide (kebab-case).'),
    label: z.string().min(1).max(40),
    href: z.string().regex(/^\/[A-Za-z0-9/_-]*$/, 'href doit commencer par /.'),
    icon: z.string().min(1),
    position: z.number().int().min(0),
    requiresRole: z.enum(['editor', 'admin', 'superadmin']).optional(),
  })
  .strict();

export const navSchema = z
  .object({
    items: z.array(navItemSchema).max(20),
  })
  .strict()
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const item of value.items) {
      if (seen.has(item.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items'],
          message: `Clé "${item.key}" dupliquée.`,
        });
      }
      seen.add(item.key);
    }
  });

export const flagsSchema = z
  .object({
    flags: z.record(FLAG_KEY, z.boolean()),
  })
  .strict();

const rbacActionEnum = z.enum(['read', 'write', 'publish', 'delete']);

const rbacResourceMatrix = z
  .object({
    components: z.array(rbacActionEnum).default([]),
    seo: z.array(rbacActionEnum).default([]),
    products: z.array(rbacActionEnum).default([]),
    media: z.array(rbacActionEnum).default([]),
    users: z.array(rbacActionEnum).default([]),
    'app-config': z.array(rbacActionEnum).default([]),
  })
  .strict();

export const rbacSchema = z
  .object({
    matrix: z.record(ROLE_KEY, rbacResourceMatrix),
  })
  .strict()
  .superRefine((value, ctx) => {
    const sa = value.matrix.superadmin;
    if (!sa) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['matrix', 'superadmin'],
        message: 'Le rôle "superadmin" est obligatoire.',
      });
      return;
    }
    for (const resource of RBAC_RESOURCES) {
      const actions = sa[resource] ?? [];
      for (const action of RBAC_ACTIONS) {
        if (!actions.includes(action)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['matrix', 'superadmin', resource],
            message: `superadmin doit avoir toutes les actions sur ${resource}.`,
          });
        }
      }
    }
  });

export const brandingSchema = z
  .object({
    colors: z
      .object({
        primary: HEX_COLOR,
        accent: HEX_COLOR,
        bg: HEX_COLOR,
        text: HEX_COLOR,
      })
      .strict(),
    fonts: z
      .object({
        heading: z.enum(FONT_WHITELIST),
        body: z.enum(FONT_WHITELIST),
      })
      .strict(),
    logoMediaId: z.string().nullable(),
  })
  .strict();

export const sectionSchemas = {
  nav: navSchema,
  flags: flagsSchema,
  rbac: rbacSchema,
  branding: brandingSchema,
} as const;

export type NavInput = z.infer<typeof navSchema>;
export type FlagsInput = z.infer<typeof flagsSchema>;
export type RbacInput = z.infer<typeof rbacSchema>;
export type BrandingInput = z.infer<typeof brandingSchema>;

export type SectionPayload<S extends Section> = S extends 'nav'
  ? NavConfig
  : S extends 'flags'
    ? FlagsConfig
    : S extends 'rbac'
      ? RbacConfig
      : BrandingConfig;

export function getSectionSchema<S extends Section>(section: S) {
  return sectionSchemas[section];
}
