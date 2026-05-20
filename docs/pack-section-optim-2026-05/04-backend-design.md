# 04 — Backend design

## 1. Vue d'ensemble

```
                    ┌─────────────────────────────┐
                    │  /kit (RSC)                 │
                    └───────────┬─────────────────┘
                                │ resolveKitPack()
                                ▼
                    ┌────────────────────────┐
                    │  resolver.ts           │
                    │  override-publié →     │
                    │  buildKitProductFeed   │
                    │  (mock pur)            │
                    └─┬──────────────────┬───┘
                      │                  │
       ┌──────────────┘                  └──────────────┐
       ▼                                                ▼
  ┌──────────────┐                              ┌─────────────────┐
  │ store.ts     │                              │ kit-feed.ts     │
  │ ext memory   │                              │ pure builder    │
  │ singleton    │                              │ + new fields    │
  └──────────────┘                              └─────────────────┘
       ▲
       │
  ┌────────────────────────────────┐
  │ /api/admin/kit/pack/route.ts   │  ← GET, PATCH
  │   /publish/route.ts            │  ← POST
  │   /reset/route.ts              │  ← POST
  └────────────────────────────────┘
       ▲
       │ admin session
       │
  ┌─────────────────────────────────┐
  │ /admin/kit/pack/page.tsx         │  ← page éditeur singleton
  └─────────────────────────────────┘
```

Réutilise **strictement** le pattern `KitVideoOverride` et
`KitCompositionOverride`. Aucune nouveauté architecturale.

## 2. Store

`apps/web/src/lib/kit/pack/store.ts` (nouveau).

```ts
import { memoryStore } from '@/lib/db/client';
import type {
  KitPackOverride,
  KitPackOverridePatch,
} from './types';

const SINGLETON_ID = 'kit-pack' as const;

interface ExtendedStore {
  kitPackOverride: KitPackOverride | null;
}

function ext(): ExtendedStore {
  const store = memoryStore() as unknown as ExtendedStore & Record<string, unknown>;
  if (typeof store.kitPackOverride === 'undefined') store.kitPackOverride = null;
  return store;
}

export function getKitPackOverride(): KitPackOverride | null {
  return ext().kitPackOverride;
}

export function upsertKitPackOverride(
  patch: KitPackOverridePatch,
  opts: { actorId?: string | null } = {},
): KitPackOverride { /* … merge field by field, draftedAt=now, publishedAt préservé … */ }

export function publishKitPackOverride(): KitPackOverride | null { /* … */ }
export function unpublishKitPackOverride(): KitPackOverride | null { /* … */ }
export function resetKitPackOverride(): void { /* … delete singleton … */ }
```

Convention identique à `KitVideoOverride` :
- `null` dans patch → reset au mock pour ce champ
- `undefined` → conserve la valeur existante
- valeur → écrase

## 3. Resolver

`apps/web/src/lib/kit/pack/resolver.ts` (nouveau).

```ts
import { buildKitProductFeed } from '@/lib/products/feed/kit-feed';
import { mockKitPageContent } from '@/data/mock/kit';
import { mockKit } from '@/data/mock/product';
import { getKitPackOverride } from './store';
import type { ResolvedKitPack } from './types';

/**
 * Version publique : ne sert l'override QUE s'il est publié.
 */
export function resolveKitPack(): ResolvedKitPack {
  const baseFeed = buildKitProductFeed(mockKit, mockKitPageContent);
  const override = getKitPackOverride();
  if (!override || !override.publishedAt) {
    return { feed: baseFeed, meta: emptyMeta() };
  }
  return {
    feed: mergeOverride(baseFeed, override),
    meta: {
      source: 'override-published',
      publishedAt: override.publishedAt,
      draftedAt: override.draftedAt,
      updatedAt: override.updatedAt,
    },
  };
}

/**
 * Version admin : sert la dernière version (draft inclus) pour piloter
 * l'aperçu temps réel de l'éditeur.
 */
export function resolveKitPackDraft(): ResolvedKitPack {
  // … idem mais inclut les drafts non publiés
}

function mergeOverride(base: ProductFeed, override: KitPackOverride): ProductFeed {
  return {
    ...base,
    hero: {
      ...base.hero,
      kicker: pickPatch(override.kicker, base.hero.kicker),
      title: pickPatch(override.title, base.hero.title),
      lead: pickPatch(override.lead, base.hero.lead),
      pricePrefix: pickPatch(override.pricePrefix, base.hero.pricePrefix),
      ctaLabel: pickPatch(override.ctaLabel, base.hero.ctaLabel),
      ctaMicrocopy: pickPatch(override.ctaMicrocopy, base.hero.ctaMicrocopy),
      ctaAccent: pickPatch(override.ctaAccent, base.hero.ctaAccent),
      perUsageHint: pickPatch(override.perUsageHint, base.hero.perUsageHint),
      valueBreakdown: pickPatch(override.valueBreakdown, base.hero.valueBreakdown),
    },
    socialProof: {
      ...base.socialProof,
      countLabelGeo: pickPatch(override.countLabelGeo, base.socialProof.countLabelGeo),
    },
  };
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

Identique au pattern `KitVideoOverride` API routes (singleton).

### 4.1 `GET /api/admin/kit/pack`

Auth admin obligatoire. Renvoie `{ override: KitPackOverride | null, resolved: ResolvedKitPack }`.

### 4.2 `PATCH /api/admin/kit/pack`

Auth admin. Body validé via `kitPackOverrideUpsertSchema` (Zod safeParse → 422 si invalide).

- `revalidateTag('kit-pack')` après upsert
- Audit log : `kit_pack.update`, resourceId = `kit-pack`, meta `{ patchKeys: [...] }`

### 4.3 `POST /api/admin/kit/pack/publish`

Auth admin. Pose `publishedAt = now`, clear `draftedAt`. 404 si pas d'override.
Audit `kit_pack.publish`.

### 4.4 `POST /api/admin/kit/pack/reset`

Auth admin. Supprime totalement l'override. Idempotent.
Audit `kit_pack.reset` avec meta `{ hadOverride: bool }`.

### 4.5 Erreurs standardisées

Réutilise `formatErrorResponse(err)` + `HttpError` (déjà éprouvé sur les
routes vidéo, composition, SEO).

## 5. Tag de revalidation

`KIT_PACK_TAG = 'kit-pack'` exporté depuis
`/api/admin/kit/pack/route.ts` et réutilisé sur les 3 sous-routes.

La page `/kit` est en `dynamic = 'force-dynamic'` → revalidation
implicite. À terme, on pourra wrap le rendu de la section dans
`unstable_cache(tag: 'kit-pack')` quand on aura ISR opt-in.

## 6. Audit log

| Action | Resource type | Resource ID | Meta |
|---|---|---|---|
| `kit_pack.update` | `kit_pack_override` | `kit-pack` | `{ patchKeys: [...] }` |
| `kit_pack.publish` | idem | idem | `{ publishedAt }` |
| `kit_pack.unpublish` | idem | idem | `{}` |
| `kit_pack.reset` | idem | idem | `{ hadOverride: bool }` |

## 7. Sécurité / permissions

- Toutes les routes `/api/admin/kit/pack/*` exigent une session admin valide
- Pas de RBAC granulaire (cohérent avec les autres éditeurs admin)
- Sanitization XSS : tous les `kicker`, `title`, `lead`, etc. passent par
  React text node (safe par défaut, pas de `dangerouslySetInnerHTML`)
- Pas de SQL injection : memoryStore. Migration Drizzle = backlog

## 8. Limites / quotas

| Limite | Valeur | Raison |
|---|---|---|
| `title` length | 120 chars | Affichage H2 1 ligne desktop max |
| `lead` length | 280 chars | 3 phrases max |
| `perUsageHint` length | 160 chars | 1 ligne 13-14 px |
| `ctaMicrocopy` length | 280 chars | Trust row 2 lignes max |
| `valueBreakdown.items` count | 1-8 | Pratique réelle 3-4 |
| `countLabelGeo` length | 120 chars | Lisibilité 1 ligne |

## 9. Performance backend

| Opération | Cible | Mesure |
|---|---|---|
| `resolveKitPack()` (mock pur) | < 1 ms | `buildKitProductFeed` + 1 map lookup |
| `resolveKitPack()` (override publié) | < 2 ms | + merge profond |
| `PATCH /api/admin/kit/pack` | p95 < 50 ms | Zod parse + map.set + audit log |
| `GET /api/admin/kit/pack` | p95 < 20 ms | 1 map lookup |

In-memory : aucun risque de saturation.

## 10. Feed XML Merchant — non-régression

Le builder `buildKitProductFeed` reste **pur et utilisé par le feed XML
Merchant** (`apps/web/src/lib/products/feed/merchant.ts`). L'override
admin **n'affecte pas le feed XML** : il s'applique uniquement au rendu
UI via `resolveKitPack`.

C'est un choix architectural :
- L'admin ne doit pas pouvoir casser silencieusement le feed XML qui va
  vers Google Merchant / Facebook Catalog (validation strict)
- Si on veut un jour permettre la modification du title/description côté
  Merchant, on créera un override séparé `KitMerchantOverride`

## 11. Backlog Drizzle

Identique aux autres modules : à terme, créer table dédiée :

```sql
CREATE TABLE kit_pack_overrides (
  id            VARCHAR(20) PRIMARY KEY,  -- 'kit-pack'
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  published_at  TIMESTAMPTZ,
  drafted_at    TIMESTAMPTZ,
  created_by    VARCHAR(40)
);
```

Hors-scope. Le memoryStore suffit pour valider l'UX admin.
