/**
 * Store de l'override singleton pack `/kit`.
 *
 *  - Singleton : un seul `KitPackOverride` par site (clé `kit:pack`).
 *  - Dual-driver : memoryStore (dev/tests) en attendant migration Drizzle.
 *  - Pas d'auth ici : c'est la responsabilité du caller (route admin).
 *
 * Pattern identique à `lib/kit/video/store.ts` et `lib/kit/composition/store.ts`.
 */
import { memoryStore } from '@/lib/db/client';

import {
  KIT_PACK_OVERRIDE_ID,
  type KitPackOverride,
  type KitPackOverridePatch,
} from './types';

interface ExtendedStore {
  kitPackOverride: KitPackOverride | null;
}

function ext(): ExtendedStore {
  const store = memoryStore() as unknown as ExtendedStore & Record<string, unknown>;
  if (typeof store.kitPackOverride === 'undefined') store.kitPackOverride = null;
  return store;
}

/** Retourne l'override singleton, ou `null` si aucun n'a été créé. */
export function getKitPackOverride(): KitPackOverride | null {
  return ext().kitPackOverride;
}

/**
 * Upsert d'un override. Crée le singleton s'il n'existe pas, sinon merge
 * le patch sur les champs existants. Marque toujours `draftedAt = now`.
 *
 *  - Une clé du patch absente → champ existant conservé.
 *  - Une clé du patch présente avec `null` → champ effacé (retour mock).
 *  - Une clé du patch présente avec valeur → champ écrasé.
 */
export function upsertKitPackOverride(
  patch: KitPackOverridePatch,
  opts: { actorId?: string | null } = {},
): KitPackOverride {
  const store = ext();
  const now = new Date();
  const existing = store.kitPackOverride;
  const merged: KitPackOverride = {
    id: KIT_PACK_OVERRIDE_ID,
    kicker: applyPatchKey(existing?.kicker, patch, 'kicker'),
    title: applyPatchKey(existing?.title, patch, 'title'),
    lead: applyPatchKey(existing?.lead, patch, 'lead'),
    pricePrefix: applyPatchKey(existing?.pricePrefix, patch, 'pricePrefix'),
    ctaLabel: applyPatchKey(existing?.ctaLabel, patch, 'ctaLabel'),
    ctaMicrocopy: applyPatchKey(existing?.ctaMicrocopy, patch, 'ctaMicrocopy'),
    priceCompareAt: applyPatchKey(existing?.priceCompareAt, patch, 'priceCompareAt'),
    priceCompareAtAriaLabel: applyPatchKey(
      existing?.priceCompareAtAriaLabel,
      patch,
      'priceCompareAtAriaLabel',
    ),
    valueBreakdown: applyPatchKey(existing?.valueBreakdown, patch, 'valueBreakdown'),
    perUsageHint: applyPatchKey(existing?.perUsageHint, patch, 'perUsageHint'),
    ctaAccent: applyPatchKey(existing?.ctaAccent, patch, 'ctaAccent'),
    countLabelGeo: applyPatchKey(existing?.countLabelGeo, patch, 'countLabelGeo'),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    draftedAt: now,
    publishedAt: existing?.publishedAt ?? null,
    createdBy: existing?.createdBy ?? opts.actorId ?? null,
  };
  store.kitPackOverride = merged;
  return merged;
}

/** Marque l'override comme publié. Renvoie `null` si rien à publier. */
export function publishKitPackOverride(): KitPackOverride | null {
  const store = ext();
  const existing = store.kitPackOverride;
  if (!existing) return null;
  const now = new Date();
  const published: KitPackOverride = {
    ...existing,
    publishedAt: now,
    draftedAt: null,
    updatedAt: now,
  };
  store.kitPackOverride = published;
  return published;
}

/** Repasse l'override en draft. Renvoie `null` si aucun override. */
export function unpublishKitPackOverride(): KitPackOverride | null {
  const store = ext();
  const existing = store.kitPackOverride;
  if (!existing) return null;
  const now = new Date();
  const draft: KitPackOverride = {
    ...existing,
    publishedAt: null,
    draftedAt: now,
    updatedAt: now,
  };
  store.kitPackOverride = draft;
  return draft;
}

/** Supprime totalement l'override (le site revient au mock). */
export function resetKitPackOverride(): void {
  ext().kitPackOverride = null;
}

function applyPatchKey<K extends keyof KitPackOverridePatch>(
  existing: KitPackOverride[K] | undefined,
  patch: KitPackOverridePatch,
  key: K,
): KitPackOverride[K] {
  if (!(key in patch)) return (existing ?? null) as KitPackOverride[K];
  const value = patch[key];
  return (value === null ? null : value) as KitPackOverride[K];
}
