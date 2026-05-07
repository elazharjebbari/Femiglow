# 02 — Couche data

## Tables Drizzle (`src/lib/db/schema.ts` à étendre)

### `media` — entité logique

| Colonne | Type | Notes |
|---|---|---|
| `id` | text PK | préfixe `me_` |
| `kind` | enum `media_kind` | `image` / `video` / `audio` |
| `source` | enum `media_source` | `upload` / `external` |
| `slug` | text UNIQUE | normalisé (`hero-rituel-mobile`), utilisé par les RSC |
| `original_url` | text | URL externe si `source = external`, sinon URL Blob du fichier source |
| `original_filename` | text | nom fichier d'origine (info uniquement) |
| `original_size_bytes` | bigint | taille de la source |
| `original_mime` | text | `image/png`, `video/mp4`, etc. |
| `original_width` | integer | width source (image/vidéo) |
| `original_height` | integer | height source |
| `original_duration_ms` | integer | vidéo/audio uniquement |
| `phash` | text | perceptual hash 64 bits hex (image uniquement) |
| `blurhash` | text | BlurHash 6×4 (~30 char) |
| `palette` | jsonb | `[{r,g,b,hex,weight}]` 3 couleurs dominantes |
| `alt` | text NOT NULL | texte alternatif (a11y obligatoire) |
| `caption` | text | légende affichable (optionnel) |
| `credit` | text | crédit photographe / source (optionnel) |
| `status` | enum `media_status` | `pending` / `processing` / `ready` / `failed` / `passthrough` |
| `failure_reason` | text | message d'erreur si `status = failed` |
| `quality_profile` | enum `media_quality_profile` | `hero` / `inline` / `thumb` (défaut `inline`) |
| `loading_strategy` | enum `media_loading_strategy` | `eager` / `viewport` / `idle` / `interaction` (défaut `viewport`) |
| `is_hero` | boolean | si `true`, force `eager` + `fetchpriority=high`, override `loading_strategy` |
| `overrides` | jsonb | bloc JSON de surcharge (cf. `08-overrides.md`) |
| `created_by` | text FK admin_users.id NULL | admin qui a importé |
| `created_at` | timestamptz default now() | |
| `updated_at` | timestamptz default now() | |
| `deleted_at` | timestamptz NULL | suppression douce |

**Indexes** :

- `media_slug_unique` UNIQUE on `(slug) WHERE deleted_at IS NULL`
- `media_phash_idx` btree on `(phash) WHERE phash IS NOT NULL`
- `media_status_idx` btree on `(status, created_at)`
- `media_kind_idx` btree on `(kind, deleted_at)`
- `media_created_at_idx` btree on `(created_at DESC)`

### `media_variants` — fichiers physiques produits

| Colonne | Type | Notes |
|---|---|---|
| `id` | text PK | préfixe `mv_` |
| `media_id` | text FK media.id ON DELETE CASCADE | |
| `format` | enum `variant_format` | `avif` / `webp` / `jpeg` / `png` / `mp4` / `webm` / `mp3` / `opus` / `poster` |
| `breakpoint` | enum `variant_breakpoint` NULL | `xs` / `sm` / `md` / `lg` / `xl` / `2xl` (NULL pour vidéo/audio) |
| `width` | integer NULL | pixels (image / poster vidéo) |
| `height` | integer NULL | |
| `bitrate_kbps` | integer NULL | vidéo/audio |
| `quality` | integer NULL | 0-100 (image) |
| `size_bytes` | bigint | |
| `url` | text | URL Blob (signed ou public selon storage) |
| `checksum` | text | sha256 hex du fichier |
| `created_at` | timestamptz default now() | |

**Indexes** :

- `variants_media_idx` btree on `(media_id)`
- `variants_format_breakpoint_idx` UNIQUE on
  `(media_id, format, breakpoint)` partial sur breakpoint NOT NULL
  (un seul fichier par combinaison)

### `media_tags` — tags pour la bibliothèque

| Colonne | Type | Notes |
|---|---|---|
| `id` | text PK | préfixe `mt_` |
| `name` | text UNIQUE | normalisé (`kit-principale`, `journal-rituel`) |
| `color` | text | hex `#aabbcc` pour le badge UI |
| `created_at` | timestamptz | |

### `media_to_tags` — jointure

| Colonne | Type |
|---|---|
| `media_id` | text FK media.id ON DELETE CASCADE |
| `tag_id` | text FK media_tags.id ON DELETE CASCADE |

PK composite `(media_id, tag_id)`.

### `media_usages` — où le média est utilisé

| Colonne | Type | Notes |
|---|---|---|
| `id` | text PK | `mu_` |
| `media_id` | text FK media.id ON DELETE CASCADE | |
| `usage_type` | enum `media_usage_type` | `page` / `section` / `og` / `email` / `webhook` |
| `route` | text | `/`, `/rituel`, `/admin/leads/{id}`, … |
| `component` | text | nom logique du composant qui consomme |
| `context` | enum `media_context` | `hero` / `inline` / `thumb` / `og` |
| `last_seen_at` | timestamptz | mise à jour à chaque rendu (best effort) |
| `created_at` | timestamptz | |

**Indexes** :

- `usages_media_idx` btree on `(media_id)`
- `usages_route_idx` btree on `(route)`
- `usages_unique` UNIQUE on `(media_id, route, component)`

### `media_jobs` — file d'attente du pipeline

| Colonne | Type | Notes |
|---|---|---|
| `id` | text PK | `mj_` |
| `media_id` | text FK | |
| `kind` | enum `media_job_kind` | `optimize` / `regenerate` / `phash` / `delete` |
| `status` | enum `media_job_status` | `pending` / `in_progress` / `done` / `failed` |
| `attempt_count` | integer default 0 | |
| `next_attempt_at` | timestamptz | |
| `error_message` | text | dernière erreur si `failed` |
| `payload` | jsonb | options spécifiques au job |
| `started_at` | timestamptz NULL | |
| `finished_at` | timestamptz NULL | |
| `created_at` | timestamptz | |

**Indexes** :

- `jobs_status_next_idx` btree on `(status, next_attempt_at)` partial
  `WHERE status IN ('pending','in_progress')`

## Enums

```ts
export const mediaKind = pgEnum('media_kind', ['image', 'video', 'audio']);
export const mediaSource = pgEnum('media_source', ['upload', 'external']);
export const mediaStatus = pgEnum('media_status', [
  'pending', 'processing', 'ready', 'failed', 'passthrough',
]);
export const mediaQualityProfile = pgEnum('media_quality_profile', [
  'hero', 'inline', 'thumb',
]);
export const mediaLoadingStrategy = pgEnum('media_loading_strategy', [
  'eager', 'viewport', 'idle', 'interaction',
]);
export const variantFormat = pgEnum('variant_format', [
  'avif', 'webp', 'jpeg', 'png', 'mp4', 'webm', 'mp3', 'opus', 'poster',
]);
export const variantBreakpoint = pgEnum('variant_breakpoint', [
  'xs', 'sm', 'md', 'lg', 'xl', '2xl',
]);
export const mediaUsageType = pgEnum('media_usage_type', [
  'page', 'section', 'og', 'email', 'webhook',
]);
export const mediaContext = pgEnum('media_context', [
  'hero', 'inline', 'thumb', 'og',
]);
export const mediaJobKind = pgEnum('media_job_kind', [
  'optimize', 'regenerate', 'phash', 'delete',
]);
export const mediaJobStatus = pgEnum('media_job_status', [
  'pending', 'in_progress', 'done', 'failed',
]);
```

## Types TypeScript exposés

`src/lib/media/types.ts` :

```ts
export interface Media {
  id: string;
  kind: 'image' | 'video' | 'audio';
  source: 'upload' | 'external';
  slug: string;
  alt: string;
  caption: string | null;
  credit: string | null;
  status: MediaStatus;
  qualityProfile: 'hero' | 'inline' | 'thumb';
  loadingStrategy: 'eager' | 'viewport' | 'idle' | 'interaction';
  isHero: boolean;
  blurhash: string | null;
  palette: PaletteEntry[];
  originalWidth: number | null;
  originalHeight: number | null;
  originalDurationMs: number | null;
  overrides: MediaOverrides;
  variants: MediaVariant[];
  tags: MediaTag[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaVariant {
  id: string;
  mediaId: string;
  format: VariantFormat;
  breakpoint: VariantBreakpoint | null;
  width: number | null;
  height: number | null;
  bitrateKbps: number | null;
  quality: number | null;
  sizeBytes: number;
  url: string;
}

export interface MediaOverrides {
  loadingStrategy?: 'eager' | 'viewport' | 'idle' | 'interaction';
  qualityProfile?: 'hero' | 'inline' | 'thumb';
  breakpoints?: VariantBreakpoint[];
  formats?: VariantFormat[];
  lazy?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
  blurhash?: boolean;
  artDirection?: Record<VariantBreakpoint, { src: string; alt?: string }>;
  customLoader?: string; // 'next' | 'cloudflare' | 'imgix'
}

export type PaletteEntry = { r: number; g: number; b: number; hex: string; weight: number };
```

## Migration initiale

Fichier `drizzle/migrations/0001_media.sql` (généré via
`pnpm db:generate --name=media`). Doit créer dans cet ordre :

1. tous les enums (`CREATE TYPE ... AS ENUM ...`),
2. `media`, `media_tags`, `media_jobs`,
3. `media_variants`, `media_to_tags`, `media_usages` (FK vers les
   précédentes),
4. tous les indexes.

## Seed (preview / dev)

Script `scripts/seed-media.ts` qui :

1. lit `docs/images/values/{home,journal,kit,maison,rituel}/*.png`,
2. crée une entrée `media` par fichier (slug = nom de fichier sans
   extension, alt généré à partir du parent `home → mains-yasmine`),
3. crée un job `optimize` pending pour chacun.

Le cron worker prend ensuite le relais et génère les variantes en
quelques secondes.

## Stratégie de double-driver

Les queries `src/lib/db/queries/media.ts`, `media-variants.ts`,
`media-jobs.ts` suivent le **même pattern** que les queries existantes
(`leads.ts`, `webhook-endpoints.ts`) :

```ts
export async function listMedia(filters: MediaFilters): Promise<MediaListResult> {
  const drizzle = db();
  if (drizzle) {
    // chemin Drizzle
  }
  // chemin memoryStore (tests vitest, dev local sans DB)
}
```

Le `memoryStore` étend `Store` dans `src/lib/db/client.ts` avec :

```ts
interface Store {
  // … existant
  media: Map<string, Media>;
  mediaVariants: Map<string, MediaVariant>;
  mediaJobs: Map<string, MediaJob>;
  mediaTags: Map<string, MediaTag>;
  mediaToTags: Set<string>;       // `${mediaId}:${tagId}`
  mediaUsages: Map<string, MediaUsage>;
}
```

## Suppression : soft + hard

- **Soft delete** par défaut (`deleted_at NOT NULL`). Le média
  disparaît de la bibliothèque mais ses variantes restent en Blob.
- **Hard delete** déclenché par un job `kind = 'delete'` :
  - supprime les variantes de Blob,
  - supprime la ligne `media` (CASCADE supprime variants + usages +
    tags).
- Hard delete automatique 30 jours après le soft delete (cron
  hebdo).

## Audit

Chaque opération sensible logge un `audit_event` avec :

| Action | `meta` |
|---|---|
| `media.uploaded` | `media_id`, `kind`, `size_bytes`, `original_filename` |
| `media.optimized` | `media_id`, `variants_count`, `total_size_bytes`, `duration_ms` |
| `media.regenerated` | `media_id`, `reason` (config_change / manual) |
| `media.deleted` | `media_id`, `soft` (boolean) |
| `media.override_changed` | `media_id`, `before`, `after` |
