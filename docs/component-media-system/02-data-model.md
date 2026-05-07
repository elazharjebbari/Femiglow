# 02 — Modèle de données

## Vue d'ensemble

```
┌──────────────────┐  1     n  ┌──────────────────────────┐ n     1  ┌─────────┐
│ siteComponents   │──────────►│ componentMediaBindings   │─────────►│ media   │
│  (registre)      │           │  (slot → media)          │          │ (table  │
└──────────────────┘           └──────────────────────────┘          │ existante│
       │                                                             └─────────┘
       │ 1
       │
       ▼ n
┌──────────────────────────────┐  n     1  ┌──────────────────────┐
│ componentAnimationBindings   │──────────►│ componentAnimations  │
│   (component → animation)    │           │   (registre profils) │
└──────────────────────────────┘           └──────────────────────┘
```

## Table : `site_components`

> Registre de tous les composants visuels du site. Source de vérité = TS
> const `lib/components/registry.ts` ; la table est synchronisée par un
> script de seed à chaque déploiement.

| Colonne                | Type                           | Contraintes                                    | Description |
|------------------------|--------------------------------|------------------------------------------------|-------------|
| `id`                   | text                           | PK                                             | `cmp_<uid>` |
| `key`                  | text                           | UNIQUE, NOT NULL                               | Slug stable, ex `hero-home`. **Jamais renommé.** |
| `name`                 | text                           | NOT NULL                                       | Nom affiché en admin, ex `Hero — Page d'accueil`. |
| `description`          | text                           |                                                | À quoi sert le composant. |
| `category`             | enum `component_category`      | NOT NULL                                       | `hero`, `section`, `card`, `gallery`, `carousel`, `banner`, `form`, `media-block`, `cta`. |
| `pageGroup`            | text                           | NOT NULL                                       | `home`, `journal`, `kit`, `maison`, `rituel`, `commerce`, `global`. |
| `filePath`             | text                           |                                                | Chemin source ex `apps/web/src/components/sections/Hero.tsx`. Indicatif. |
| `slots`                | jsonb (`SlotDefinition[]`)     | NOT NULL DEFAULT `[]`                          | Définition des slots possibles (cf. ci-dessous). |
| `defaultSvgFallback`   | text                           |                                                | Path public du SVG par défaut, ex `/journal/voix-de-sara.svg`. |
| `defaultLoadingStrategy` | enum `media_loading_strategy` | NOT NULL DEFAULT `'viewport'`                  | `eager`, `viewport`, `idle`, `interaction`. |
| `defaultFetchPriority` | enum `fetch_priority`          | NOT NULL DEFAULT `'auto'`                      | `high`, `low`, `auto`. |
| `supportsAnimation`    | boolean                        | NOT NULL DEFAULT `true`                        | Si false, l'admin ne peut pas binder d'animation. |
| `metadata`             | jsonb                          | NOT NULL DEFAULT `{}`                          | Props attendus, dimensions, hints éditoriaux. |
| `createdAt`            | timestamp                      | NOT NULL DEFAULT now()                         | |
| `updatedAt`            | timestamp                      | NOT NULL DEFAULT now()                         | |

**Index** : `UNIQUE(key)`, `INDEX(pageGroup)`, `INDEX(category)`.

### `SlotDefinition` (JSON)

```ts
type SlotDefinition = {
  key: string;             // 'primary' | 'background' | 'thumbnail' | 'slide-1' ...
  label: string;           // 'Image principale'
  required: boolean;
  acceptKinds: ('image' | 'video')[];
  aspectRatioHint?: string;  // '3:2' | '1:1' | '16:9'
  recommendedWidth?: number; // 1200
  description?: string;
};
```

## Table : `component_media_bindings`

> Une ligne = un slot d'un composant a un média assigné (ou désactivé).

| Colonne              | Type                          | Contraintes                              | Description |
|----------------------|-------------------------------|------------------------------------------|-------------|
| `id`                 | text                          | PK                                       | `cmb_<uid>` |
| `componentId`        | text                          | FK `siteComponents.id` ON DELETE CASCADE | |
| `slot`               | text                          | NOT NULL                                 | Doit matcher un `SlotDefinition.key`. |
| `mediaId`            | text                          | FK `media.id` ON DELETE SET NULL         | Nullable : un binding peut être "défini mais sans média assigné". |
| `loadingStrategy`    | enum `media_loading_strategy` | NOT NULL DEFAULT `'viewport'`            | Override du composant. |
| `fetchPriority`      | enum `fetch_priority`         | NOT NULL DEFAULT `'auto'`                | |
| `priority`           | boolean                       | NOT NULL DEFAULT `false`                 | Equivalent `priority` de `next/image` (LCP). |
| `placeholderStrategy`| enum `placeholder_strategy`   | NOT NULL DEFAULT `'svg'`                 | `svg`, `blurhash`, `palette`, `none`. |
| `customAlt`          | text                          |                                          | Override de `media.alt`. |
| `displayOrder`       | integer                       | NOT NULL DEFAULT `0`                     | Pour les carrousels (slide-1 ordre 1, slide-2 ordre 2…). |
| `isActive`           | boolean                       | NOT NULL DEFAULT `false`                 | Si false → fallback SVG. **Sécurité par défaut.** |
| `notes`              | text                          |                                          | Notes admin. |
| `createdAt`          | timestamp                     | NOT NULL DEFAULT now()                   | |
| `updatedAt`          | timestamp                     | NOT NULL DEFAULT now()                   | |
| `createdBy`          | text                          | FK `adminUsers.id` ON DELETE SET NULL    | |

**Index** :
- `UNIQUE(componentId, slot)` — un seul binding par slot.
- `INDEX(mediaId)` — pour les "qui utilise ce média".
- `INDEX(componentId, isActive)` — pour resolveComponentMedia.

## Table : `component_animations`

> Registre des profils d'animation réutilisables.

| Colonne                | Type                       | Contraintes                  | Description |
|------------------------|----------------------------|------------------------------|-------------|
| `id`                   | text                       | PK                           | `cma_<uid>` |
| `key`                  | text                       | UNIQUE, NOT NULL             | `none`, `fade-in`, `reveal-up`, `scale-hover`, `schema-svg`, `parallax-soft`. |
| `name`                 | text                       | NOT NULL                     | Nom UI. |
| `kind`                 | enum `animation_kind`      | NOT NULL                     | `none`, `framer-motion`, `css`, `svg`. |
| `description`          | text                       |                              | |
| `config`               | jsonb                      | NOT NULL DEFAULT `{}`        | Variants framer-motion ou keyframes CSS. |
| `respectsReducedMotion`| boolean                    | NOT NULL DEFAULT `true`      | |
| `previewSnippet`       | text                       |                              | Code TSX d'aperçu (pour la doc admin). |
| `createdAt`            | timestamp                  | NOT NULL DEFAULT now()       | |
| `updatedAt`            | timestamp                  | NOT NULL DEFAULT now()       | |

**Profils seed (V1)** :
- `none` — aucune animation
- `fade-in` — opacity 0→1, 600ms
- `reveal-up` — opacity 0→1 + translateY 24px→0, 700ms `ease-out`
- `scale-hover` — `whileHover: { scale: 1.02 }`, 700ms cubic-bezier
- `parallax-soft` — translateY scroll-driven, ratio 0.15
- `schema-svg` — pathLength 0→1 par couche (utilisé par SciencesDuSoin)

## Table : `component_animation_bindings`

> Quels profils d'animation sont autorisés / actifs sur quel composant.

| Colonne       | Type      | Contraintes                              |
|---------------|-----------|------------------------------------------|
| `id`          | text      | PK                                       |
| `componentId` | text      | FK `siteComponents.id` ON DELETE CASCADE |
| `animationId` | text      | FK `componentAnimations.id` ON DELETE CASCADE |
| `isDefault`   | boolean   | NOT NULL DEFAULT `false`                 |
| `params`      | jsonb     | NOT NULL DEFAULT `{}`                    | Override des params (duration, delay…) |
| `createdAt`   | timestamp | NOT NULL DEFAULT now()                   |

**Contrainte** : `UNIQUE(componentId, animationId)`. Un composant peut avoir
plusieurs animations potentielles, mais une seule `isDefault=true`.

## Enums

```ts
component_category    = 'hero' | 'section' | 'card' | 'gallery' | 'carousel'
                      | 'banner' | 'form' | 'media-block' | 'cta';
animation_kind        = 'none' | 'framer-motion' | 'css' | 'svg';
placeholder_strategy  = 'svg' | 'blurhash' | 'palette' | 'none';

# Ré-utilisés (déjà dans schema.ts) :
media_loading_strategy = 'eager' | 'viewport' | 'idle' | 'interaction';
fetch_priority         = 'high' | 'low' | 'auto';
```

## Migrations

Le fichier `0004_component_media_system.sql` créera :
1. Les enums (CREATE TYPE … if not exists).
2. Les 4 tables.
3. Les indices.

Pas de backfill : les bindings sont créés à la demande via le seed admin.

## Storage memoryStore

Pour le mode dual-driver (tests + dev sans Postgres) :

```ts
interface Store {
  // ...
  siteComponents: Map<string, SiteComponent>;
  componentMediaBindings: Map<string, ComponentMediaBinding>;
  componentAnimations: Map<string, ComponentAnimation>;
  componentAnimationBindings: Map<string, ComponentAnimationBinding>;
}
```

## Audit

Toutes les mutations (`create binding`, `update binding`, `delete binding`,
`assign animation`) passent par `auditTrackingChange` avec :
- `resource: 'component_media_binding' | 'component_animation_binding'`
- `action: 'create' | 'update' | 'delete' | 'assign' | 'unassign'`

(On étend l'enum `TrackingAction` et `TrackingResource` dans
`apps/web/src/lib/tracking/server/audit.ts`.)
