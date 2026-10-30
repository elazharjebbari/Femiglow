/**
 * Médias par audience — lecture et validation de la politique (module pur).
 *
 *  - `readMediaVariantPolicy` : relit `site_components.metadata.mediaVariants`
 *    (JSON non typé) et renvoie une politique sûre, ou `null`.
 *  - `validateMediaVariantPolicy` : cohérence d'une politique du registre.
 *  - `validateMediaSetShape` : contrôle d'un ensemble avant écriture
 *    (slot déclaré, dimension, clé, langue, nombre d'items, point focal).
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.1–4.2
 */
import { z } from 'zod';
import { LOCALES } from '@/i18n.config';
import type {
  MediaVariantPolicy,
  MediaVariantSlotPolicy,
} from '@/lib/components/registry';
import {
  DEFAULT_DIMENSION,
  WILDCARD,
  isKnownDimension,
  isValidVariantKey,
} from './dimensions';

/** Langues acceptées pour un ensemble : les locales du site + `*`. */
export const MEDIA_SET_LOCALES: readonly string[] = [WILDCARD, ...LOCALES];

/** Plafond absolu d'une liste quand la politique ne fixe pas `maxItems`. */
export const MEDIA_SET_LIST_HARD_CAP = 12;

const aspectSchema = z.union([
  z.object({ mobile: z.string().min(1), desktop: z.string().min(1) }),
  z.object({ all: z.string().min(1) }),
]);

const slotPolicySchema = z.object({
  key: z.string().min(1),
  kind: z.enum(['single', 'list']),
  maxItems: z.number().int().positive().optional(),
  aspect: aspectSchema,
  legacySlots: z.array(z.string().min(1)).optional(),
});

const policySchema = z.object({
  slots: z.array(slotPolicySchema).min(1),
  dimensions: z.array(z.string().min(1)),
});

/** Relit la politique depuis `metadata` ; `null` si absente ou malformée. */
export function readMediaVariantPolicy(metadata: unknown): MediaVariantPolicy | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>).mediaVariants;
  if (raw === undefined || raw === null) return null;
  const parsed = policySchema.safeParse(raw);
  return parsed.success ? (parsed.data as MediaVariantPolicy) : null;
}

export function findSlotPolicy(
  policy: MediaVariantPolicy,
  slot: string,
): MediaVariantSlotPolicy | null {
  return policy.slots.find((s) => s.key === slot) ?? null;
}

/** Nombre maximal d'items d'un ensemble pour ce slot. */
export function slotMaxItems(slot: MediaVariantSlotPolicy): number {
  if (slot.kind === 'single') return 1;
  return Math.min(slot.maxItems ?? MEDIA_SET_LIST_HARD_CAP, MEDIA_SET_LIST_HARD_CAP);
}

/**
 * Cohérence d'une politique du registre. Renvoie la liste des problèmes
 * (vide = valide). `legacySlotKeys` = slots `component_media_bindings`
 * déclarés par le composant (pour vérifier `legacySlots`).
 */
export function validateMediaVariantPolicy(
  policy: MediaVariantPolicy,
  legacySlotKeys: readonly string[],
): string[] {
  const issues: string[] = [];
  if (!policySchema.safeParse(policy).success) issues.push('policy.shape');
  const seen = new Set<string>();
  for (const slot of policy.slots) {
    if (seen.has(slot.key)) issues.push(`slot.duplicate:${slot.key}`);
    seen.add(slot.key);
    if (slot.kind === 'list' && slot.maxItems === undefined) {
      issues.push(`slot.max_items_missing:${slot.key}`);
    }
    if (slot.maxItems !== undefined && slot.maxItems > MEDIA_SET_LIST_HARD_CAP) {
      issues.push(`slot.max_items_too_big:${slot.key}`);
    }
    for (const legacy of slot.legacySlots ?? []) {
      if (!legacySlotKeys.includes(legacy)) {
        issues.push(`slot.legacy_unknown:${slot.key}->${legacy}`);
      }
    }
  }
  const dims = new Set<string>();
  for (const dim of policy.dimensions) {
    if (dim === DEFAULT_DIMENSION) issues.push('dimension.default_is_implicit');
    else if (!isKnownDimension(dim)) issues.push(`dimension.unknown:${dim}`);
    if (dims.has(dim)) issues.push(`dimension.duplicate:${dim}`);
    dims.add(dim);
  }
  return issues;
}

export interface MediaSetShapeItem {
  mediaId: string;
  mobileMediaId?: string | null;
  alt?: Record<string, unknown> | null;
  focalX?: number | null;
  focalY?: number | null;
}

export interface MediaSetShapeInput {
  slot: string;
  variantDim: string;
  variantKey: string;
  locale: string;
  items: readonly MediaSetShapeItem[];
}

export interface MediaSetIssue {
  code: string;
  path: (string | number)[];
  message: string;
}

const ALT_MAX_LENGTH = 300;

function isFocal(value: number | null | undefined): boolean {
  return value === null || value === undefined || (Number.isInteger(value) && value >= 0 && value <= 100);
}

/**
 * Contrôle d'un ensemble avant écriture. Renvoie la liste des problèmes
 * (vide = valide). N'interroge pas la base : l'existence des médias est
 * vérifiée par la couche requêtes.
 */
export function validateMediaSetShape(
  policy: MediaVariantPolicy,
  input: MediaSetShapeInput,
): MediaSetIssue[] {
  const issues: MediaSetIssue[] = [];
  const slot = findSlotPolicy(policy, input.slot);
  if (!slot) {
    issues.push({ code: 'slot.unknown', path: ['slot'], message: `Slot inconnu : ${input.slot}` });
  }

  if (input.variantDim === DEFAULT_DIMENSION) {
    if (input.variantKey !== WILDCARD) {
      issues.push({
        code: 'variant_key.invalid',
        path: ['variantKey'],
        message: "La dimension « default » n'accepte que la clé « * »",
      });
    }
  } else if (!policy.dimensions.includes(input.variantDim)) {
    issues.push({
      code: 'variant_dim.unknown',
      path: ['variantDim'],
      message: `Dimension non déclarée : ${input.variantDim}`,
    });
  } else if (!isValidVariantKey(input.variantDim, input.variantKey)) {
    issues.push({
      code: 'variant_key.invalid',
      path: ['variantKey'],
      message: `Clé invalide pour ${input.variantDim} : ${input.variantKey}`,
    });
  }

  if (!MEDIA_SET_LOCALES.includes(input.locale)) {
    issues.push({ code: 'locale.invalid', path: ['locale'], message: `Langue invalide : ${input.locale}` });
  }

  if (input.items.length === 0) {
    issues.push({ code: 'items.empty', path: ['items'], message: 'Au moins une image est requise' });
  } else if (slot) {
    const max = slotMaxItems(slot);
    if (input.items.length > max) {
      issues.push({
        code: slot.kind === 'single' ? 'items.single' : 'items.too_many',
        path: ['items'],
        message:
          slot.kind === 'single'
            ? 'Ce slot accepte une seule image'
            : `Maximum ${max} images pour ce slot`,
      });
    }
  }

  input.items.forEach((item, i) => {
    if (!item.mediaId) {
      issues.push({ code: 'item.media_missing', path: ['items', i, 'mediaId'], message: 'Média requis' });
    }
    if (!isFocal(item.focalX) || !isFocal(item.focalY)) {
      issues.push({
        code: 'item.focal_invalid',
        path: ['items', i, 'focal'],
        message: 'Le point focal doit être un entier entre 0 et 100',
      });
    }
    for (const [lang, text] of Object.entries(item.alt ?? {})) {
      if (!(LOCALES as readonly string[]).includes(lang)) {
        issues.push({ code: 'item.alt_locale', path: ['items', i, 'alt', lang], message: `Langue d'alt inconnue : ${lang}` });
      } else if (typeof text !== 'string' || text.length > ALT_MAX_LENGTH) {
        issues.push({
          code: 'item.alt_invalid',
          path: ['items', i, 'alt', lang],
          message: `Alt invalide (texte de ${ALT_MAX_LENGTH} caractères au maximum)`,
        });
      }
    }
  });

  return issues;
}
