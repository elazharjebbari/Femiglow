# 02 — Architecture (Data, Backend, Frontend)

> Modèle de données, schemas Drizzle, seed registry, queries, data flow RSC → client, liste exhaustive des composants à créer et modifier.

---

## 1. Vue d'ensemble — Flow de données

```
                                                     ┌──────────────────┐
                                                     │ getKitHeroData() │
                                                     │  (RSC server)    │
                                                     └────────┬─────────┘
                                                              │
                       ┌──────────────────────────────────────┴───────────────┐
                       │                                                       │
                       ▼                                                       ▼
            ┌────────────────────┐                                ┌────────────────────────┐
            │ resolveComponent   │                                │ getKitHeroGalleryImages│
            │  Fields(           │                                │  (productId)            │
            │  'kit-hero-produit'│                                │                         │
            │ )                  │                                │ ┌──────────────────┐    │
            └─────────┬──────────┘                                │ │ slot primary     │    │
                      │                                           │ │ (existant)       │    │
                      ▼                                           │ ├──────────────────┤    │
            ┌────────────────────┐                                │ │ slot contextual_*│    │
            │  CMS fields:       │                                │ │ (nouveaux fields)│    │
            │  - tagline         │                                │ ├──────────────────┤    │
            │  - description     │                                │ │ review_photos    │    │
            │  - attributeChips  │                                │ │ (nouvelle table) │    │
            │  - reviewBadge     │                                │ └──────────────────┘    │
            │     (visible Y/N)  │                                └────────────┬───────────┘
            │  - trustRow items  │                                             │
            └─────────┬──────────┘                                             │
                      │                                                        │
                      └──────────────────────┬─────────────────────────────────┘
                                             │
                                             ▼
                                  ┌──────────────────────┐
                                  │  <HeroProduitBound>  │ (RSC)
                                  └──────────┬───────────┘
                                             │
                                             ▼
                                  ┌──────────────────────┐
                                  │  <HeroProduit>       │ (client component, hydraté)
                                  └──────────┬───────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          ▼                  ▼                  ▼
                  <HeroGallery>      <SocialProofBadge> <AttributeChips>
                  (client)           (client)           (client)
                          │
                          ├── <GalleryMain>
                          ├── <GalleryThumbnails> (desktop)
                          ├── <GalleryDots> (mobile)
                          └── <GalleryArrow> (desktop optionnel)
```

---

## 2. Modèle de données

### 2.1 Nouveaux fields editorial sur `kit-hero-produit`

Ajout dans `apps/web/src/lib/components/registry.ts` à l'entrée existante du composant `kit-hero-produit` (lignes 679-710 actuelles, on ajoute le tableau `fields[]`).

| Field key | Type | Default | Group | Order | Required | Pourquoi |
|---|---|---|---|---|---|---|
| `tagline` | `text` | `"Manucure japonaise halal. Deux gestes, un polissoir. La main se révèle."` | `Contenu` | 1 | false | Sous-titre court au-dessus du prix |
| `description` | `multiline` | (voir §3 ci-dessous) | `Contenu` | 2 | false | Description longue, déplacée sous CTA |
| `attributeChips` | `list` | `["Sans vernis", "Sans UV", "Sans acétone", "Halal"]` | `Réassurance` | 3 | false | 4 chips d'attributs |
| `trustRow` | `list` | `["Livraison offerte", "Paiement à la livraison", "Retour 30 jours"]` | `Réassurance` | 4 | false | Ligne de réassurance au-dessus du CTA |
| `reviewBadgeEnabled` | `boolean` | `true` | `Social proof` | 5 | false | Affichage du badge note + avis |
| `reviewBadgeOverride` | `record` | `null` | `Social proof` | 6 | false | Override manuel `{ rating, reviewsCount }` (si vide → fallback `DEFAULT_KIT_REVIEW_STATS`) |
| `ctaPulseEnabled` | `boolean` | `true` | `CTA` | 7 | false | Activer/désactiver la micro-pulsation 600 ms |

> **Note** : la valeur `description` par défaut sera mise à jour avec la version retenue dans `01-vision-design.md` §5.1.
> Le champ `reviewBadgeOverride` permet à l'admin de forcer une valeur si la table reviews est vide (cas de test ou hors-ligne).

### 2.2 Nouvelle table `product_review_photos`

**Migration** : `apps/web/drizzle/migrations/0057_review_photos.sql`

```sql
-- Migration 0057 — Photos clientes affichées dans la galerie hero
CREATE TABLE IF NOT EXISTS product_review_photos (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  review_id TEXT,                          -- null si photo orpheline (UGC uploadé sans avis)
  src TEXT NOT NULL,                       -- URL/chemin image (Cloudinary, R2, ou local /public)
  alt TEXT NOT NULL DEFAULT 'Photo cliente',
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  blur_data_url TEXT,                      -- LQIP pour blur placeholder
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  reviewer_initials TEXT,                  -- "I. R." pour "Imane, Rabat" — anonymisation
  reviewer_city TEXT,                      -- "Rabat" — affichage caption optionnel
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_photos_product
  ON product_review_photos (product_id, status, display_order);
```

### 2.3 Schema Drizzle correspondant

À ajouter dans `apps/web/src/lib/db/schema.ts` :

```typescript
export const productReviewPhotos = pgTable(
  'product_review_photos',
  {
    id: text('id').primaryKey(),
    productId: text('product_id').notNull(),
    reviewId: text('review_id'),
    src: text('src').notNull(),
    alt: text('alt').notNull().default('Photo cliente'),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    blurDataUrl: text('blur_data_url'),
    displayOrder: integer('display_order').notNull().default(0),
    status: text('status', { enum: ['draft', 'published', 'archived'] })
      .notNull()
      .default('published'),
    reviewerInitials: text('reviewer_initials'),
    reviewerCity: text('reviewer_city'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    productOrderIdx: index('idx_review_photos_product')
      .on(t.productId, t.status, t.displayOrder),
  }),
);

export type ProductReviewPhoto = typeof productReviewPhotos.$inferSelect;
```

### 2.4 Helpers de seed (memoryStore + DB)

`apps/web/src/lib/db/client.ts` :

```typescript
interface MemoryStore {
  // ... existant
  productReviewPhotos: Map<string, ProductReviewPhoto>;
}
```

`apps/web/scripts/seed-reviews-photos.ts` (nouveau script) :

```typescript
// Lit /public/reviews/*.jpg et insère N entries par défaut
// Exécuté par AUTO_SEED=1 sur fresh DB
// Idempotent (skip si productId déjà a ≥ 2 photos)
```

---

## 3. Description par défaut — Texte définitif

```
Le pack FemiGlow associe deux soins et un polissoir, pensés pour la
manucure japonaise halal. Une paste qui lisse, une powder qui lustre,
un polissoir Step 4 Polish & Shine. Sans vernis, sans lampe UV, sans
acétone. Quelques gestes suffisent. L'ongle nu retrouve sa lumière.
Le woudou reste intact.
```

À mettre dans `defaultValue` du field `description` (§2.1).

---

## 4. Backend — Helpers et queries

### 4.1 Nouveau helper `getKitHeroGalleryImages`

**Fichier** : `apps/web/src/lib/products/kit-hero-gallery.ts` (nouveau).

```typescript
/**
 * Construit la liste d'images affichées dans la galerie hero du kit.
 *
 * Ordre de priorité :
 *  1. Slot primary (packshot principal) — toujours en première position
 *  2. Slot contextual_1 et contextual_2 (si bindings actifs)
 *  3. Photos clientes (product_review_photos, status='published', ORDER BY display_order)
 *
 * Si la table review_photos est vide, retourne uniquement les slots produit.
 */
export async function getKitHeroGalleryImages(productId: string): Promise<HeroGalleryImage[]> { ... }
```

**Type retourné** :

```typescript
export interface HeroGalleryImage {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  blurDataURL?: string;
  kind: 'product' | 'context' | 'review';
  caption?: string;            // ex: "I. R. · Rabat" pour reviews
}
```

### 4.2 Étendre `kit-hero-produit` slots

Dans `apps/web/src/lib/components/registry.ts`, ajouter 2 slots supplémentaires :

```typescript
slots: [
  { ...SLOT_HERO_PRIMARY, aspectRatioHint: '4/5', recommendedWidth: 1200, ... },
  { key: 'context_1', label: 'Contextuelle 1 (main qui applique)', aspectRatioHint: '4/5', recommendedWidth: 1200, cropToAspect: false, objectFitDefault: 'cover' },
  { key: 'context_2', label: 'Contextuelle 2 (table de chevet)', aspectRatioHint: '4/5', recommendedWidth: 1200, cropToAspect: false, objectFitDefault: 'cover' },
],
```

### 4.3 Évolution `HeroProduitBound`

Avant : résout un seul slot `primary`, passe en `mediaSlot` à `HeroProduit`.

Après : résout `primary` + `context_1` + `context_2` + fetch `getKitHeroGalleryImages(productId)`, fusionne et passe à `HeroProduit` via `galleryImages: HeroGalleryImage[]`.

---

## 5. Frontend — Composants

### 5.1 Composants à créer (NEW)

| Composant | Fichier | Type | Responsabilité |
|---|---|---|---|
| `HeroGallery` | `apps/web/src/components/sections/hero/HeroGallery.tsx` | client | Orchestrateur galerie : state index, swap, swipe, thumbnails |
| `HeroGalleryMain` | `apps/web/src/components/sections/hero/HeroGalleryMain.tsx` | client | Image principale animée |
| `HeroGalleryThumbnails` | `apps/web/src/components/sections/hero/HeroGalleryThumbnails.tsx` | client | Colonne vignettes desktop |
| `HeroGalleryDots` | `apps/web/src/components/sections/hero/HeroGalleryDots.tsx` | client | Indicateur dots mobile |
| `HeroGalleryArrow` | `apps/web/src/components/sections/hero/HeroGalleryArrow.tsx` | client | Boutons next/prev desktop (optionnel) |
| `AttributeChips` | `apps/web/src/components/commerce/AttributeChips.tsx` | server (synchrone) | 4 chips d'attributs |
| `SocialProofBadge` | `apps/web/src/components/commerce/SocialProofBadge.tsx` | server (synchrone) | Étoiles + note + avis |
| `TrustRow` | `apps/web/src/components/commerce/TrustRow.tsx` | server (synchrone) | Ligne de réassurance |

### 5.2 Composants à modifier

| Composant | Fichier | Changements |
|---|---|---|
| `HeroProduit` | `apps/web/src/components/sections/HeroProduit.tsx` | Layout grid refondu, intégration nouveaux composants, mobile-first |
| `HeroProduitBound` | `apps/web/src/components/sections/HeroProduitBound.tsx` | Résout `getKitHeroGalleryImages(productId)` + fields editorial supplémentaires |
| `registry.ts` | `apps/web/src/lib/components/registry.ts` | Ajout `fields[]` au composant `kit-hero-produit` + 2 slots supplémentaires |
| `schema.ts` | `apps/web/src/lib/db/schema.ts` | Ajout `productReviewPhotos` table |
| `client.ts` | `apps/web/src/lib/db/client.ts` | Ajout `productReviewPhotos: Map` dans memoryStore |

### 5.3 Composants supprimés ou dépréciés

Aucun. Toutes les modifications sont additives ou rétrocompatibles.

### 5.4 Hooks personnalisés (NEW)

| Hook | Fichier | Responsabilité |
|---|---|---|
| `useGallery` | `apps/web/src/components/sections/hero/useGallery.ts` | State `currentIndex`, `setIndex`, `next`, `prev`, keyboard + swipe handlers |
| `useReducedMotion` | (peut déjà exister) | Détection `prefers-reduced-motion` |
| `useMediaQuery` | (peut déjà exister) | Pour basculer entre thumbs/dots selon viewport |

> Avant de créer `useReducedMotion` et `useMediaQuery`, vérifier dans `apps/web/src/lib/hooks/` s'ils existent déjà (ils peuvent être nommés différemment).

---

## 6. Props et API des composants

### 6.1 `HeroGallery`

```typescript
export interface HeroGalleryProps {
  images: HeroGalleryImage[];        // Au minimum 1, idéalement 4-7
  initialIndex?: number;             // Default 0
  ariaLabel?: string;                // Default "Galerie produit"
  /** Si true, affiche les thumbnails à gauche sur desktop. */
  showThumbnails?: boolean;          // Default true
  /** Callback appelé à chaque changement (analytics). */
  onChange?: (index: number, image: HeroGalleryImage) => void;
  /** Mode reduced-motion : désactive les transitions internes. */
  reducedMotion?: boolean;
}
```

### 6.2 `AttributeChips`

```typescript
export interface AttributeChipsProps {
  items: string[];                   // Max 6, idéal 4
  ariaLabel?: string;                // Default "Attributs produit"
  className?: string;
}
```

### 6.3 `SocialProofBadge`

```typescript
export interface SocialProofBadgeProps {
  rating: number;                    // 0-5, ex: 4.8
  reviewsCount: number;              // Entier
  ariaLabel?: string;                // Default auto-généré : "Note 4,8 sur 5 basée sur 287 avis"
  size?: 'sm' | 'md';                // Default 'md'
  /** Optionnel : si fourni, le badge devient un lien vers cette ancre. */
  href?: string;                     // Default undefined (non-cliquable)
}
```

### 6.4 `TrustRow`

```typescript
export interface TrustRowProps {
  items: string[];                   // 2-4 items
  separator?: string;                // Default '·'
  className?: string;
}
```

### 6.5 `HeroProduit` (refonte des props)

```typescript
export interface HeroProduitProps {
  product: Product;
  reassurances: ReassuranceData[];
  /** Images de galerie résolues côté serveur. */
  galleryImages: HeroGalleryImage[];
  /** Champs editorial CMS résolus. */
  fields: {
    tagline: string;
    description: string;
    attributeChips: string[];
    trustRow: string[];
    reviewBadgeEnabled: boolean;
    reviewBadgeOverride: { rating: number; reviewsCount: number } | null;
    ctaPulseEnabled: boolean;
  };
  /** Stats reviews (rating + count) — fallback DEFAULT_KIT_REVIEW_STATS. */
  reviewStats: ProductReviewStats;
  observeId?: string;
  commanderMode?: 'wizard-anchor' | 'cart-redirect';
}
```

---

## 7. Mise à jour seed

### 7.1 Étapes seed

1. **Mettre à jour `registry.ts`** — ajouter `fields[]` au composant `kit-hero-produit`.
2. **Exécuter `pnpm seed:components`** — synchronise les definitions de composants en DB.
3. **Exécuter `pnpm seed:components-fields`** — crée les bindings par défaut (status='published').
4. **Migration `0057_review_photos.sql`** — crée la table.
5. **Exécuter `pnpm seed:reviews-photos`** (nouveau script) — insère 3-6 photos par défaut depuis `/public/reviews/*.jpg` si présentes, sinon skip silencieusement.

### 7.2 Images de seed (review photos)

Mettre dans `apps/web/public/reviews/` :
- `imane-rabat.jpg` (anonyme, plan rapproché mains)
- `souad-casa.jpg`
- `nora-tanger.jpg`

> Si ces images n'existent pas physiquement, le script seed log un warning et continue. Les photos peuvent être ajoutées plus tard via l'admin upload (chantier hors périmètre).

---

## 8. Validation TypeScript

Pas de breaking change attendu sur les types existants. Les nouveaux types sont :

- `HeroGalleryImage` exporté depuis `apps/web/src/lib/products/kit-hero-gallery.ts`
- `ProductReviewPhoto` exporté depuis `apps/web/src/lib/db/types.ts` (via `$inferSelect`)
- Props des nouveaux composants

Tous les imports utilisent les alias `@/...` existants.

---

## 9. Plan de migration data

| Ordre | Action | Reversible ? | Risque |
|---|---|---|---|
| 1 | Ajout fields registry | Oui (revert) | Aucun (read-only au runtime) |
| 2 | Seed bindings fields | Oui (delete bindings) | Aucun |
| 3 | Migration `0057_review_photos.sql` | Oui (drop table) | Aucun (additive) |
| 4 | Seed photos | Oui (delete rows) | Aucun |
| 5 | Update default `description` | Oui (re-seed) | Aucun |

**Aucune migration destructive.** Tous les changements sont additifs et réversibles.

---

## 10. Voir aussi

- [`03-vignette-system.md`](03-vignette-system.md) — spec UX détaillée de la galerie
- [`04-test-strategy.md`](04-test-strategy.md) — tests pour chaque composant ci-dessus
- `apps/web/src/lib/components/registry.ts` — fichier à modifier (lignes 679-710)
- `apps/web/src/lib/products/reviews.ts` — module existant à étendre
