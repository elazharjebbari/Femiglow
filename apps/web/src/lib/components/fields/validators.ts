/**
 * Validators Zod par `FieldType` (Components-CMS).
 *
 * Pour chaque `ComponentFieldDefinition`, on fabrique un schéma Zod qui valide
 * la **valeur encodée** (cf. encoding.ts). Les contraintes (`maxLength`,
 * `options`, `allowedHosts`, …) viennent de `FieldTypeConfig`.
 *
 * Cf. docs/components-cms/backend/02-zod-validation.md
 *     docs/components-cms/architecture/06-rbac-audit.md (XSS, open redirect,
 *       path traversal).
 *
 * Ce module est pur (pas de `'server-only'`) afin que MSW & Vitest puissent
 * l'importer dans des tests d'intégration.
 */
import { z } from 'zod';

import type {
  ComponentFieldDefinition,
  FieldType,
  FieldTypeConfig,
} from '@/lib/db/types';

import { decodeValue } from './encoding';

export interface ValidationError {
  path: (string | number)[];
  message: string;
  code: string;
}

export type ValidationResult =
  | { ok: true; value: unknown }
  | { ok: false; errors: ValidationError[] };

/* ──────────────────────────────────────────────────────────────────
 * Primitives partagées
 * ────────────────────────────────────────────────────────────────── */

interface HrefSchemaOptions {
  allowedHosts?: string[];
  allowedSchemes?: ('http' | 'https' | 'mailto' | 'tel')[];
}

/**
 * `href` accepté :
 *   - relatif (`/...`) ou ancre (`#...`)
 *   - `mailto:` / `tel:` valides
 *   - URL HTTPS dont le host est dans `config.allowedHosts`
 *
 * Si `allowedHosts` est vide ou absent, seuls relatifs + mailto + tel sont
 * acceptés (pas d'ouverture par défaut). Refus = signal d'open redirect.
 */
export function hrefSchema(options: HrefSchemaOptions = {}): z.ZodType<string> {
  const allowedHosts = options.allowedHosts ?? [];
  const schemes = options.allowedSchemes ?? ['https', 'mailto', 'tel'];

  return z
    .string()
    .min(1, "L'URL est requise")
    .max(500, "L'URL est trop longue")
    .refine((href) => {
      const trimmed = href.trim();
      if (!trimmed) return false;
      // URL protocol-relative interdites (`//evil.com` résout en runtime
      // vers un host externe sans contrôle).
      if (trimmed.startsWith('//')) return false;
      if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
      if (trimmed.startsWith('mailto:')) {
        return (
          schemes.includes('mailto') &&
          /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
        );
      }
      if (trimmed.startsWith('tel:')) {
        return schemes.includes('tel') && /^tel:\+?[0-9 ()-]{6,}$/.test(trimmed);
      }
      try {
        const url = new URL(trimmed);
        const proto = url.protocol.replace(':', '');
        if (!schemes.includes(proto as 'http' | 'https' | 'mailto' | 'tel')) {
          return false;
        }
        if (proto === 'http' || proto === 'https') {
          return allowedHosts.includes(url.host);
        }
        return false;
      } catch {
        return false;
      }
    }, "L'URL doit être relative ou pointer vers un domaine autorisé");
}

const ICON_KEY_RE = /^[a-z0-9][a-z0-9-]*$/i;

/** Schéma d'icône : caractères safe + max 50, aucun `..`/slash. */
function iconKeySchema(allowedIcons?: string[]): z.ZodType<string> {
  if (allowedIcons && allowedIcons.length > 0) {
    return z.enum(allowedIcons as [string, ...string[]], {
      errorMap: () => ({ message: 'Icône inconnue' }),
    });
  }
  return z
    .string()
    .min(1, "L'icône est requise")
    .max(50, "Nom d'icône trop long")
    .regex(ICON_KEY_RE, "Nom d'icône invalide");
}

const COLOR_TOKEN_RE = /^[a-z][a-z0-9-]*$/;

/* ──────────────────────────────────────────────────────────────────
 * Builder — schéma par FieldType
 * ────────────────────────────────────────────────────────────────── */

export interface BuildSchemaOptions {
  /** Liste d'icônes autorisées injectée à l'extérieur (registre `lucide`…). */
  allowedIcons?: string[];
}

/**
 * Construit le schéma Zod de la **valeur encodée** d'un champ. Le schéma
 * retourné peut être passé tel quel à `safeParse(value)`.
 */
export function buildFieldSchema(
  fieldDef: ComponentFieldDefinition,
  options: BuildSchemaOptions = {},
): z.ZodType<unknown> {
  return schemaForType(fieldDef.type, fieldDef.config, options);
}

function schemaForType(
  type: FieldType,
  cfg: FieldTypeConfig | undefined,
  options: BuildSchemaOptions,
): z.ZodType<unknown> {
  switch (type) {
    case 'text': {
      const min = cfg?.minLength ?? 0;
      const max = cfg?.maxLength ?? 500;
      return z.object({
        v: z
          .string()
          .min(min, `Minimum ${min} caractères`)
          .max(max, `Maximum ${max} caractères`),
      });
    }
    case 'multiline': {
      const min = cfg?.minLength ?? 0;
      const max = cfg?.maxLength ?? 5000;
      return z.object({
        v: z
          .string()
          .min(min, `Minimum ${min} caractères`)
          .max(max, `Maximum ${max} caractères`),
      });
    }
    case 'rich-text': {
      const min = cfg?.minLength ?? 0;
      const max = cfg?.maxLength ?? 8000;
      return z.object({
        v: z
          .string()
          .min(min, `Minimum ${min} caractères`)
          .max(max, `Maximum ${max} caractères`),
      });
    }
    case 'kicker': {
      const max = cfg?.maxLength ?? 30;
      return z.object({
        v: z.string().min(0).max(max, `Maximum ${max} caractères`),
      });
    }
    case 'cta': {
      const allowedVariants = (cfg?.variants ?? [
        'primary',
        'secondary',
        'ghost',
        'link',
      ]) as [string, ...string[]];
      return z.object({
        label: z.string().min(1, 'Label requis').max(60, 'Label trop long'),
        href: hrefSchema({ allowedHosts: cfg?.allowedHosts }),
        variant: z.enum(allowedVariants).optional(),
        icon: iconKeySchema(options.allowedIcons).optional(),
      });
    }
    case 'link': {
      return z.object({
        href: hrefSchema({ allowedHosts: cfg?.allowedHosts }),
        label: z.string().min(0).max(60, 'Label trop long').optional(),
        external: z.boolean().optional(),
      });
    }
    case 'icon': {
      return z.object({ v: iconKeySchema(options.allowedIcons) });
    }
    case 'color-token': {
      return z.object({
        v: z
          .string()
          .min(1, 'Token requis')
          .regex(COLOR_TOKEN_RE, 'Token couleur invalide'),
      });
    }
    case 'number': {
      const min = cfg?.min ?? Number.NEGATIVE_INFINITY;
      const max = cfg?.max ?? Number.POSITIVE_INFINITY;
      let n = z.number({ invalid_type_error: 'Nombre attendu' });
      if (Number.isFinite(min)) n = n.min(min, `Doit être supérieur ou égal à ${min}`);
      if (Number.isFinite(max)) n = n.max(max, `Doit être inférieur ou égal à ${max}`);
      let final: z.ZodType<number> = n;
      if (cfg?.step != null && cfg.step > 0) {
        const step = cfg.step;
        const base = Number.isFinite(min) ? min : 0;
        final = n.refine(
          (v) => Math.abs(((v - base) / step) - Math.round((v - base) / step)) < 1e-9,
          { message: `Doit être un multiple de ${step}` },
        );
      }
      return z.object({ v: final });
    }
    case 'boolean': {
      return z.object({
        v: z.boolean({ invalid_type_error: 'Booléen attendu' }),
      });
    }
    case 'enum': {
      if (!cfg?.options || cfg.options.length === 0) {
        throw new Error("FieldDefinition 'enum' requires config.options");
      }
      const values = cfg.options.map((o) => o.value) as [string, ...string[]];
      return z.object({
        v: z.enum(values, {
          errorMap: () => ({ message: 'Valeur non autorisée' }),
        }),
      });
    }
    case 'list': {
      if (!cfg?.itemType) {
        throw new Error("FieldDefinition 'list' requires config.itemType");
      }
      const itemSchema = schemaForType(cfg.itemType, cfg.itemConfig, options);
      const minItems = cfg.minItems ?? 0;
      const maxItems = cfg.maxItems ?? 100;
      return z.object({
        items: z
          .array(itemSchema)
          .min(minItems, `Minimum ${minItems} éléments`)
          .max(maxItems, `Maximum ${maxItems} éléments`),
      });
    }
    case 'record': {
      if (!cfg?.shape) {
        throw new Error("FieldDefinition 'record' requires config.shape");
      }
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [key, sub] of Object.entries(cfg.shape)) {
        const sub_schema = schemaForType(sub.type, sub.config, options);
        shape[key] = sub.required ? sub_schema : sub_schema.optional();
      }
      return z.object({ fields: z.object(shape) });
    }
    case 'quote': {
      return z.object({
        text: z.string().min(1, 'Texte requis').max(500, 'Texte trop long'),
        author: z.string().min(0).max(120, 'Nom trop long').optional(),
      });
    }
    case 'breadcrumb-segment': {
      return z.object({
        label: z.string().min(1, 'Label requis').max(60, 'Label trop long'),
        href: hrefSchema({ allowedHosts: cfg?.allowedHosts }),
      });
    }
  }
}

/* ──────────────────────────────────────────────────────────────────
 * Wrappers conviviaux
 * ────────────────────────────────────────────────────────────────── */

/**
 * Valide la valeur encodée d'un champ selon sa définition. Renvoie soit
 * `{ ok: true, value }` (parsed propre), soit `{ ok: false, errors }` avec
 * messages français.
 */
export function validateFieldValue(
  fieldDef: ComponentFieldDefinition,
  value: unknown,
  options: BuildSchemaOptions = {},
): ValidationResult {
  let schema: z.ZodType<unknown>;
  try {
    schema = buildFieldSchema(fieldDef, options);
  } catch (err) {
    return {
      ok: false,
      errors: [
        {
          path: [],
          code: 'definition_error',
          message: err instanceof Error ? err.message : 'Définition de champ invalide',
        },
      ],
    };
  }
  const parsed = schema.safeParse(value);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, errors: formatZodErrorsFr(parsed.error) };
}

/**
 * Variante shorthand qui décode une valeur "à plat" si elle ne semble pas
 * encodée. Utile pour les routes qui acceptent les deux formes côté client.
 */
export function validateField(
  fieldDef: ComponentFieldDefinition,
  raw: unknown,
  options: BuildSchemaOptions = {},
): ValidationResult {
  const isEnvelopeShape =
    raw !== null &&
    typeof raw === 'object' &&
    (
      'v' in (raw as object) ||
      'items' in (raw as object) ||
      'fields' in (raw as object) ||
      'href' in (raw as object) ||
      'label' in (raw as object) ||
      'text' in (raw as object)
    );
  const candidate = isEnvelopeShape ? raw : decodeValue(raw, fieldDef.type);
  return validateFieldValue(fieldDef, candidate, options);
}

/* ──────────────────────────────────────────────────────────────────
 * Erreurs Zod → FR
 * ────────────────────────────────────────────────────────────────── */

const FR_MESSAGES: Record<string, string> = {
  invalid_type: 'Type invalide',
  invalid_string: 'Format invalide',
  too_small: 'Valeur trop courte',
  too_big: 'Valeur trop longue',
  invalid_enum_value: 'Valeur non autorisée',
  invalid_union: 'Aucun format ne correspond',
  custom: 'Valeur invalide',
  unrecognized_keys: 'Clés non reconnues',
  invalid_arguments: 'Arguments invalides',
  invalid_return_type: 'Type de retour invalide',
  invalid_date: 'Date invalide',
  not_multiple_of: 'Doit être un multiple',
  not_finite: 'Nombre non fini',
};

/**
 * Traduit les erreurs Zod en `ValidationError[]` lisibles en FR.
 * Privilégie le message déjà fourni par le schéma (ex. "Maximum 60 caractères")
 * et tombe sur un libellé générique si Zod n'a posté qu'un code brut.
 */
export function formatZodErrorsFr(error: z.ZodError): ValidationError[] {
  return error.issues.map((iss) => {
    const fallback = FR_MESSAGES[iss.code as string] ?? 'Valeur invalide';
    let message = iss.message && iss.message.length > 0 ? iss.message : fallback;
    // Quand Zod n'a pas eu de message custom, son `message` peut être un
    // libellé EN par défaut ("Required", "String must contain at least N…").
    if (/^Required$/.test(message)) message = 'Ce champ est requis';
    if (/^String must contain at least 1 character/i.test(message)) {
      message = 'Ce champ est requis';
    }
    if (/^Expected/i.test(message) && /received/i.test(message)) {
      message = fallback;
    }
    return {
      path: [...iss.path],
      message,
      code: iss.code,
    };
  });
}
