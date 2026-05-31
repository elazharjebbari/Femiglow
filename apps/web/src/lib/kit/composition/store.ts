/**
 * Store memoryStore pour les overrides de composition `/kit`.
 *
 *  - 3 entries max (1 par sous-produit).
 *  - Pattern `ext()` cohérent avec SEO, kit-video, etc.
 *  - Migration Drizzle prévue en backlog (cf. doc 04 §9).
 */
import { memoryStore } from '@/lib/db/client';
import type {
  KitCompositionOverride,
  KitCompositionOverridePatch,
  KitCompositionSubProductId,
} from './types';

interface ExtendedStore {
  kitCompositionOverrides: Map<KitCompositionSubProductId, KitCompositionOverride>;
}

function ext(): ExtendedStore {
  const store = memoryStore() as unknown as ExtendedStore & Record<string, unknown>;
  if (!store.kitCompositionOverrides) {
    store.kitCompositionOverrides = new Map();
  }
  return store;
}

export function getKitCompositionOverride(
  subProductId: KitCompositionSubProductId,
): KitCompositionOverride | null {
  return ext().kitCompositionOverrides.get(subProductId) ?? null;
}

export function listKitCompositionOverrides(): KitCompositionOverride[] {
  return Array.from(ext().kitCompositionOverrides.values());
}

export function upsertKitCompositionOverride(
  patch: KitCompositionOverridePatch,
  opts: { actorId?: string | null } = {},
): KitCompositionOverride {
  const now = new Date();
  const existing = ext().kitCompositionOverrides.get(patch.subProductId);
  const merged: KitCompositionOverride = {
    id: `kit-composition:${patch.subProductId}`,
    subProductId: patch.subProductId,
    narrative: applyKey(existing?.narrative, patch, 'narrative'),
    usageHint: applyKey(existing?.usageHint, patch, 'usageHint'),
    accentColor: applyKey(existing?.accentColor, patch, 'accentColor'),
    ingredients: applyKey(existing?.ingredients, patch, 'ingredients'),
    certifications: applyKey(existing?.certifications, patch, 'certifications'),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    draftedAt: now,
    publishedAt: existing?.publishedAt ?? null,
    createdBy: existing?.createdBy ?? opts.actorId ?? null,
  };
  ext().kitCompositionOverrides.set(patch.subProductId, merged);
  return merged;
}

export function publishKitCompositionOverride(
  subProductId: KitCompositionSubProductId,
): KitCompositionOverride | null {
  const existing = ext().kitCompositionOverrides.get(subProductId);
  if (!existing) return null;
  const now = new Date();
  const published: KitCompositionOverride = {
    ...existing,
    publishedAt: now,
    draftedAt: null,
    updatedAt: now,
  };
  ext().kitCompositionOverrides.set(subProductId, published);
  return published;
}

export function unpublishKitCompositionOverride(
  subProductId: KitCompositionSubProductId,
): KitCompositionOverride | null {
  const existing = ext().kitCompositionOverrides.get(subProductId);
  if (!existing) return null;
  const now = new Date();
  const draft: KitCompositionOverride = {
    ...existing,
    publishedAt: null,
    draftedAt: now,
    updatedAt: now,
  };
  ext().kitCompositionOverrides.set(subProductId, draft);
  return draft;
}

export function resetKitCompositionOverride(
  subProductId: KitCompositionSubProductId,
): void {
  ext().kitCompositionOverrides.delete(subProductId);
}

function applyKey<K extends keyof KitCompositionOverridePatch>(
  existing: KitCompositionOverride[K] | undefined,
  patch: KitCompositionOverridePatch,
  key: K,
): KitCompositionOverride[K] {
  if (!(key in patch)) return (existing ?? null) as KitCompositionOverride[K];
  return (patch[key] === null ? null : patch[key]) as KitCompositionOverride[K];
}
