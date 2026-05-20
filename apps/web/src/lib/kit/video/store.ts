/**
 * Store de l'override singleton vidéo `/kit`.
 *
 *  - Singleton : un seul `KitVideoOverride` par site (clé `kit:video`).
 *  - Dual-driver : memoryStore (dev/tests) en attendant migration Drizzle.
 *    L'ouverture vers Drizzle se fera via un slot dédié dans `schema.ts`
 *    (cf. plan §06-admin-ui-ux-design.md §7).
 *  - Pas d'auth ici : c'est la responsabilité du caller (route admin).
 */
import { memoryStore } from '@/lib/db/client';
import {
  KIT_VIDEO_OVERRIDE_ID,
  type KitVideoOverride,
  type KitVideoOverridePatch,
} from './types';

interface ExtendedStore {
  kitVideoOverride: KitVideoOverride | null;
}

function ext(): ExtendedStore {
  const store = memoryStore() as unknown as ExtendedStore & Record<string, unknown>;
  if (typeof store.kitVideoOverride === 'undefined') store.kitVideoOverride = null;
  return store;
}

/** Retourne l'override singleton, ou `null` si aucun n'a été créé. */
export function getKitVideoOverride(): KitVideoOverride | null {
  return ext().kitVideoOverride;
}

/**
 * Upsert d'un override. Crée le singleton s'il n'existe pas, sinon merge
 * le patch sur les champs existants. Marque toujours `draftedAt = now`
 * (le draft est dirty tant qu'on n'a pas appelé `publishKitVideoOverride`).
 *
 *  - Une clé du patch absente → champ existant conservé.
 *  - Une clé du patch présente avec `null` → champ effacé (retour mock).
 *  - Une clé du patch présente avec valeur → champ écrasé.
 */
export function upsertKitVideoOverride(
  patch: KitVideoOverridePatch,
  opts: { actorId?: string | null } = {},
): KitVideoOverride {
  const store = ext();
  const now = new Date();
  const existing = store.kitVideoOverride;
  const merged: KitVideoOverride = {
    id: KIT_VIDEO_OVERRIDE_ID,
    youtubeUrl: applyPatchKey(existing?.youtubeUrl, patch, 'youtubeUrl'),
    provenance: applyPatchKey(existing?.provenance, patch, 'provenance'),
    durationDisplay: applyPatchKey(existing?.durationDisplay, patch, 'durationDisplay'),
    accentColor: applyPatchKey(existing?.accentColor, patch, 'accentColor'),
    posterCustom: applyPatchKey(existing?.posterCustom, patch, 'posterCustom'),
    chapters: applyPatchKey(existing?.chapters, patch, 'chapters'),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    draftedAt: now,
    publishedAt: existing?.publishedAt ?? null,
    createdBy: existing?.createdBy ?? opts.actorId ?? null,
  };
  store.kitVideoOverride = merged;
  return merged;
}

/**
 * Marque l'override comme publié (`publishedAt = now`, `draftedAt = null`).
 * Renvoie `null` si aucun override n'existe (rien à publier).
 */
export function publishKitVideoOverride(): KitVideoOverride | null {
  const store = ext();
  const existing = store.kitVideoOverride;
  if (!existing) return null;
  const now = new Date();
  const published: KitVideoOverride = {
    ...existing,
    publishedAt: now,
    draftedAt: null,
    updatedAt: now,
  };
  store.kitVideoOverride = published;
  return published;
}

/**
 * Repasse l'override en draft (efface `publishedAt`, repose `draftedAt`).
 * Renvoie `null` si aucun override n'existe.
 */
export function unpublishKitVideoOverride(): KitVideoOverride | null {
  const store = ext();
  const existing = store.kitVideoOverride;
  if (!existing) return null;
  const now = new Date();
  const draft: KitVideoOverride = {
    ...existing,
    publishedAt: null,
    draftedAt: now,
    updatedAt: now,
  };
  store.kitVideoOverride = draft;
  return draft;
}

/** Supprime totalement l'override (le site revient au mock). */
export function resetKitVideoOverride(): void {
  ext().kitVideoOverride = null;
}

function applyPatchKey<K extends keyof KitVideoOverridePatch>(
  existing: KitVideoOverride[K] | undefined,
  patch: KitVideoOverridePatch,
  key: K,
): KitVideoOverride[K] {
  if (!(key in patch)) return (existing ?? null) as KitVideoOverride[K];
  const value = patch[key];
  return (value === null ? null : value) as KitVideoOverride[K];
}
