# 04 — Backend design

## 1. Vue d'ensemble

```
                ┌─────────────────────────────────┐
                │   /kit (RSC)                    │
                └──────────────┬──────────────────┘
                               │ resolveKitComposition(id)
                               ▼
                   ┌───────────────────────┐
                   │  resolver.ts          │
                   │  cascade :            │
                   │  override-publié      │
                   │   → mock              │
                   └─┬────────────────┬────┘
                     │                │
        ┌────────────┘                └─────────────┐
        ▼                                            ▼
  ┌──────────────┐                            ┌─────────────┐
  │ store.ts     │                            │ mockKit     │
  │ ext memory   │                            │ PageContent │
  │ + Drizzle    │                            │ composition │
  │ (backlog)    │                            └─────────────┘
  └──────────────┘
        ▲
        │ get/upsert/publish/unpublish/reset
        │
  ┌──────────────────────────────────┐
  │ /api/admin/kit/composition/[id]  │  ← GET, PATCH
  │   /publish                       │  ← POST
  │   /unpublish                     │  ← POST
  │   /reset                         │  ← POST
  └──────────────────────────────────┘
        ▲
        │ admin session
        │
  ┌─────────────────────────────────┐
  │ /admin/kit/composition/[id]     │  ← page éditeur (Phase 5)
  └─────────────────────────────────┘
```

Réutilise **strictement** le pattern `KitVideoOverride` (cf. video phase 6.A
livré). Aucune nouveauté architecturale.

## 2. Store

`apps/web/src/lib/kit/composition/store.ts` (nouveau).

```ts
import { memoryStore } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type {
  KitCompositionOverride,
  KitCompositionOverridePatch,
} from './types';

const SUB_PRODUCT_IDS = ['1-paste', '2-powder', '3-polissoir'] as const;
type SubProductId = (typeof SUB_PRODUCT_IDS)[number];

interface ExtendedStore {
  kitCompositionOverrides: Map<SubProductId, KitCompositionOverride>;
}

function ext(): ExtendedStore {
  const store = memoryStore() as unknown as ExtendedStore & Record<string, unknown>;
  if (!store.kitCompositionOverrides) {
    store.kitCompositionOverrides = new Map();
  }
  return store;
}

export function getKitCompositionOverride(
  subProductId: SubProductId,
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
  subProductId: SubProductId,
): KitCompositionOverride | null { /* … pose publishedAt, clear draftedAt … */ }

export function unpublishKitCompositionOverride(
  subProductId: SubProductId,
): KitCompositionOverride | null { /* … */ }

export function resetKitCompositionOverride(subProductId: SubProductId): void {
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
```

## 3. Resolver

`apps/web/src/lib/kit/composition/resolver.ts` (nouveau).

```ts
import { mockKitPageContent } from '@/data/mock/kit';
import type { SubProduct } from '@/lib/schemas';
import { getKitCompositionOverride } from './store';
import type {
  KitCompositionOverride,
  KitCompositionSource,
  ResolvedKitComposition,
} from './types';

/**
 * Version publique : ne sert l'override QUE s'il est publié.
 * Tout le reste retombe sur le mock.
 */
export function resolveKitComposition(): ResolvedKitComposition[] {
  return mockKitPageContent.composition.map((sub) => {
    const override = getKitCompositionOverride(sub.id as any);
    if (!override || !override.publishedAt) {
      return { subProduct: sub, meta: emptyMeta() };
    }
    return {
      subProduct: mergeOverride(sub, override),
      meta: {
        source: 'override-published',
        publishedAt: override.publishedAt,
        draftedAt: override.draftedAt,
        updatedAt: override.updatedAt,
      },
    };
  });
}

/**
 * Version admin : sert la dernière version (draft inclus) pour piloter
 * l'aperçu temps réel de l'éditeur.
 */
export function resolveKitCompositionDraft(): ResolvedKitComposition[] {
  // … idem mais inclut les drafts non publiés
}

function mergeOverride(
  base: SubProduct,
  override: KitCompositionOverride,
): SubProduct {
  return {
    ...base,
    narrative: pickPatch(override.narrative, base.narrative),
    usageHint: pickPatch(override.usageHint, base.usageHint),
    ingredients: override.ingredients
      ? mergeIngredients(base.ingredients, override.ingredients)
      : base.ingredients,
    certifications: pickPatch(override.certifications, base.certifications),
  };
}

function mergeIngredients(base, patch) {
  // Match par INCI (clé immuable), merge champ par champ
  // Préserve l'ordre du base, ajoute en queue les ingredients du patch non matchés
}

function pickPatch<T>(over: T | null | undefined, base: T | undefined): T | undefined {
  if (over === null) return base;
  if (over === undefined) return base;
  return over;
}

function emptyMeta() {
  return { source: 'mock' as const, publishedAt: null, draftedAt: null, updatedAt: null };
}
```

## 4. API routes

Identique au pattern `KitVideoOverride` API routes.

### 4.1 `GET /api/admin/kit/composition/[id]`

Auth admin obligatoire. Renvoie `{ override: KitCompositionOverride | null, resolved: ResolvedKitComposition }`.

Param `[id]` ∈ `'1-paste' | '2-powder' | '3-polissoir'` — sinon 404.

### 4.2 `PATCH /api/admin/kit/composition/[id]`

Auth admin. Body validé via `kitCompositionOverrideUpsertSchema` (Zod
safeParse → 422 si invalid).

- Sanitization additionnelle :
  - `narrative` : trim, max 320 chars, regex ponctuation finale
  - `usageHint` : trim, max 60 chars
  - `inciDefinition` (chaque) : trim, max 200 chars
- Append `revalidateTag('kit-composition')` + `revalidateTag(`kit-composition:${id}`)`
- Audit log : action `kit_composition.update`, resourceId = `kit-composition:${id}`

### 4.3 `POST /api/admin/kit/composition/[id]/publish`

Auth admin. Pose `publishedAt = now`, clear `draftedAt`. 404 si pas d'override
pour ce subProductId. Audit `kit_composition.publish`.

### 4.4 `POST /api/admin/kit/composition/[id]/unpublish`

Auth admin. Repasse en draft. Audit `kit_composition.unpublish`.

### 4.5 `POST /api/admin/kit/composition/[id]/reset`

Auth admin. Supprime totalement l'override (revient au mock pur).
Audit `kit_composition.reset` avec meta `{ hadOverride: bool }`.

### 4.6 Erreurs standardisées

Réutilise `formatErrorResponse(err)` + `HttpError` de `lib/errors/http-error`
(déjà éprouvé sur les routes vidéo et SEO).

## 5. Tag de revalidation

`KIT_COMPOSITION_TAG = 'kit-composition'` exporté depuis
`/api/admin/kit/composition/[id]/route.ts` et réutilisé sur les 4 sous-routes.

Le tag est appliqué côté lecture par le RSC `IngredientsDetailsBound`
(Phase 5) via `unstable_cache`. Pour cette refonte, on reste sur
`dynamic = 'force-dynamic'` sur la page `/kit` (déjà le cas) — donc la
revalidation est implicite.

## 6. Audit log

Réutilise `logAuditEvent` de `lib/audit/log-event` :

| Action | Resource type | Resource ID | Meta |
|---|---|---|---|
| `kit_composition.update` | `kit_composition_override` | `kit-composition:1-paste` | `{ patchKeys: ['narrative', 'ingredients'] }` |
| `kit_composition.publish` | idem | idem | `{ publishedAt }` |
| `kit_composition.unpublish` | idem | idem | `{}` |
| `kit_composition.reset` | idem | idem | `{ hadOverride: bool }` |

## 7. Sécurité / permissions

- Toutes les routes `/api/admin/kit/composition/*` exigent une session
  admin valide (`getAdminSession()` → 401 si null).
- Pas de RBAC granulaire — un admin = peut tout faire (cohérent avec les
  autres éditeurs admin).
- Sanitization XSS : aucune input utilisateur n'est rendue en
  `dangerouslySetInnerHTML`. Tous les `narrative` / `inciDefinition` /
  `usageHint` passent par React text node (safe par défaut).
- Pas de SQL injection : memoryStore pour l'instant. Quand on migrera
  vers Drizzle (backlog), utiliser les query builders typés (déjà la
  norme du repo).

## 8. Limites / quotas

| Limite | Valeur | Raison |
|---|---|---|
| `narrative` length | 320 chars | Affichage 3 phrases max |
| `usageHint` length | 60 chars | Clausule inline dans titre |
| `inciDefinition` length | 200 chars | Tooltip popover lisible |
| `ingredients[]` count | ≤ 20 par sous-produit | Pratique réelle ≤ 10 |
| `certifications[]` count | ≤ 8 | Pratique réelle ≤ 5 |

Les limites empêchent un admin d'exploser le poids de la page (chaque
champ contribue au HTML statique).

## 9. Backlog Drizzle (post-refonte)

Si on persiste sur la stack en prod, ajouter table dédiée :

```sql
CREATE TABLE kit_composition_overrides (
  id            VARCHAR(80) PRIMARY KEY,
  sub_product_id VARCHAR(40) NOT NULL UNIQUE,
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  published_at  TIMESTAMPTZ,
  drafted_at    TIMESTAMPTZ,
  created_by    VARCHAR(40)
);

CREATE INDEX idx_kit_composition_published
  ON kit_composition_overrides (sub_product_id, published_at);
```

Migration drizzle générée + tests query. **Hors-scope** de ce dossier — à
traiter quand on aura besoin de persistance multi-instance ou cluster.

## 10. Performance backend

| Opération | Cible | Mesure |
|---|---|---|
| `resolveKitComposition()` (mock pur) | < 0,5 ms | Pas d'I/O, juste in-memory |
| `resolveKitComposition()` (avec override) | < 1 ms | Single map lookup |
| `PATCH /api/admin/kit/composition/[id]` | p95 < 50 ms | Zod parse + map.set + audit log |
| `GET /api/admin/kit/composition/[id]` | p95 < 20 ms | 2 map lookups |

Tous ces opérations sont in-memory : aucun risque de saturation.

## 11. Logging

Aucun log structuré côté route à l'exception des audit events. En cas
d'erreur, `formatErrorResponse` log déjà via `logger`.

En dev, ajouter un breadcrumb `[kit-composition.upsert]` si on touche
plus de 5 fois par seconde (signal admin en train de spammer save —
warning seulement, pas de throttling).
