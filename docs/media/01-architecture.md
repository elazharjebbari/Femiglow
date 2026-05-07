# 01 — Architecture

## Vue d'ensemble

```
┌────────────────────────────────────────────────────────────────────┐
│                          NAVIGATEUR (cliente)                       │
│  Next.js page (RSC)                                                 │
│   ├─ <MediaImage id="me_xx" context="hero" />                       │
│   │     ↳ rend <picture> + srcset + LQIP + SVG placeholder fallback │
│   ├─ <MediaVideo id="me_yy" lazy="interaction" />                   │
│   └─ <MediaAudio id="me_zz" />                                      │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │ HTML / RSC stream
┌──────────────────────────────────▼─────────────────────────────────┐
│                       NEXT.JS 14 (Vercel fra1)                      │
│ ┌─────────────────────────────┐  ┌────────────────────────────────┐ │
│ │ /admin/media (RSC)          │  │ /api/admin/media/* (POST/PATCH)│ │
│ │ /admin/media/{id}           │  │ /api/admin/media/upload        │ │
│ │ /admin/media/upload         │  │ /api/admin/media/{id}/optimize │ │
│ │ /admin/media/settings       │  │ /api/cron/media-optimize       │ │
│ └─────────────────────────────┘  │ /api/media/{id} (GET, public)  │ │
│                                  └────────────────────────────────┘ │
│ ┌─────────────────────────────┐  ┌────────────────────────────────┐ │
│ │ Pipeline workers            │  │ Storage adapter                │ │
│ │   - sharp (images)          │  │   - local (fs)                 │ │
│ │   - fluent-ffmpeg (vidéo)   │  │   - vercel-blob                │ │
│ │   - music-metadata (audio)  │  │   - external-passthrough       │ │
│ └─────────────────────────────┘  └────────────────────────────────┘ │
└────────────┬────────────────────────────────────┬──────────────────┘
             │                                    │
   ┌─────────▼──────────┐               ┌─────────▼──────────────┐
   │   Neon Postgres    │               │ Vercel Blob (prod)     │
   │   - media          │               │ /local _media/ (dev)   │
   │   - media_variants │               │ S3 backup (Phase 2)    │
   │   - media_tags     │               └────────────────────────┘
   │   - media_usages   │
   │   - audit_events   │
   └────────────────────┘
```

## Composants

### Côté serveur

1. **Storage adapter** (`src/lib/media/storage/`) — interface unique
   avec implémentations interchangeables (`local`, `vercelBlob`,
   `external`). Sélection via `env.MEDIA_STORAGE_DRIVER`.
2. **Pipeline workers** (`src/lib/media/pipeline/`) — fonctions pures
   qui prennent un fichier source + une config et produisent les
   variantes :
   - `optimizeImage(src, config) → Variant[]`
   - `optimizeVideo(src, config) → Variant[]`
   - `optimizeAudio(src, config) → Variant[]`
3. **Queue** (`src/lib/media/queue/`) — table `media_jobs` (statut
   `pending` / `processing` / `done` / `failed`) consommée par le
   cron `/api/cron/media-optimize` toutes les minutes.
4. **Queries** (`src/lib/db/queries/media*.ts`) — couche d'accès DB
   en double-driver (Drizzle si `DATABASE_URL`, sinon `memoryStore`),
   homogène avec les autres queries du module admin.
5. **API routes** :
   - `/api/admin/media/upload` (multipart, créé entrée + job pipeline)
   - `/api/admin/media` (CRUD : GET liste, POST, PATCH, DELETE soft)
   - `/api/admin/media/{id}/regenerate` (relance pipeline)
   - `/api/cron/media-optimize` (worker cron)
   - `/api/media/{id}` (lecture publique, JSON minimal)

### Côté client

1. **Composants** (`src/components/media/`) :
   - `<MediaImage>`, `<MediaVideo>`, `<MediaAudio>`,
   - `<MediaPlaceholder>` (SVG fallback),
   - `<MediaLazy>` (HOC qui applique la stratégie de chargement).
2. **Hooks** (`src/lib/media/hooks/`) :
   - `useMediaInView(ref, opts)` — IntersectionObserver wrappé,
   - `useNetworkInfo()` — détection saveData / effectiveType,
   - `useReducedMotion()` — `prefers-reduced-motion`.
3. **Admin UI** (`src/app/admin/media/`) — pages RSC pour la
   bibliothèque, l'upload, le détail, les réglages.

## Flux d'upload (séquence)

```
Fondatrice                Admin UI         API /upload         Pipeline cron      Postgres        Blob
   │                          │                 │                   │              │             │
   │ drop fichier             │                 │                   │              │             │
   ├─────────────────────────►│                 │                   │              │             │
   │                          │ validate UI     │                   │              │             │
   │                          │ (taille, MIME)  │                   │              │             │
   │                          │                 │                   │              │             │
   │                          │ POST /upload    │                   │              │             │
   │                          ├────────────────►│                   │              │             │
   │                          │                 │ magic-bytes       │              │             │
   │                          │                 │ ─ check ─►        │              │             │
   │                          │                 │ stash source      │              │             │
   │                          │                 ├────────────────────────────────────────────────►│
   │                          │                 │ INSERT media      │              │             │
   │                          │                 │  (status=pending) │              │             │
   │                          │                 ├──────────────────────────────────►│             │
   │                          │                 │ INSERT media_jobs │              │             │
   │                          │                 ├──────────────────────────────────►│             │
   │                          │ 201 + media id  │                   │              │             │
   │                          │◄────────────────┤                   │              │             │
   │ toast "import OK"        │                 │                   │              │             │
   │◄─────────────────────────┤                 │                   │              │             │
   │                          │                 │                   │              │             │
   │                          │                 │   ┌──── tick (toutes les 60s) ───┴──────────►  │
   │                          │                 │   │                                            │
   │                          │                 │   │ claim job pending                          │
   │                          │                 │   ├───────►◄──────────────────────────         │
   │                          │                 │   │ download source                            │
   │                          │                 │   ├──────────────────────────────────────────► │
   │                          │                 │   │ ◄──────────── source bytes ───────────── │
   │                          │                 │   │ sharp/ffmpeg → N variantes                 │
   │                          │                 │   │ upload variantes                           │
   │                          │                 │   ├──────────────────────────────────────────► │
   │                          │                 │   │ INSERT media_variants                      │
   │                          │                 │   ├──────────────────────►                     │
   │                          │                 │   │ UPDATE media SET status=ready              │
   │                          │                 │   ├──────────────────────►                     │
   │                          │                 │   │ logAuditEvent media.optimized              │
   │                          │                 │   ├──────────────────────►                     │
   │                          │                 │
   │ recharge la liste       │                 │
   ├─────────────────────────►│                 │
   │                          │ GET /admin/media│
   │                          │ → status=ready  │
```

## Flux de rendu (séquence)

```
RSC page (/rituel)            <MediaImage id="me_kit_principale">
    │                                    │
    │ getMedia('me_kit_principale')      │
    ├───────────────────────────────────►│
    │ ◄────── Media + Variants ──────────┤
    │                                    │
    │ rend <picture>                     │
    │   <source srcset="...avif" type="image/avif">
    │   <source srcset="...webp" type="image/webp">
    │   <img src="...jpeg" alt="..."     │
    │        loading={strategy}          │
    │        fetchpriority={priority}    │
    │        width="1280" height="800"   │
    │        style={{backgroundImage: blurhash || svg-placeholder}}>
    │ </picture>                         │
    │                                    │
    ▼                                    ▼
   HTML envoyé au navigateur            (côté client)
                                        │
                                        ├─ navigator.connection.saveData ?
                                        │   └─ true → swap srcset vers profil "low"
                                        │
                                        ├─ IntersectionObserver fire
                                        │   └─ src devient effectif
                                        │
                                        └─ image décodée → fade-in 200ms
```

## Choix architecturaux

### Pourquoi un pipeline asynchrone (et pas synchrone à l'upload) ?

- L'upload synchrone bloquerait l'UI 5–60 s et ferait timeouter Vercel
  Functions sur les vidéos.
- L'asynchrone permet de garder l'UI réactive : la fondatrice voit
  immédiatement son média en `pending`, peut continuer à travailler,
  et reçoit une notif quand il est `ready`.
- Le cron tourne déjà toutes les minutes (`/api/cron/tick` pour les
  webhooks) — on factorise un cron unique `/api/cron/media-optimize`
  parallèle ou on étend le tick existant. **Décision retenue** : route
  cron séparée pour isoler les budgets et éviter qu'un encodage
  vidéo lent ne bloque le traitement webhooks.

### Pourquoi `<picture>` natif et pas seulement `next/image` ?

Next.js Image gère un seul format à la fois (par défaut WebP/AVIF
selon Accept). Avec `<picture>` on peut servir :

- **AVIF en priorité** (économies 30 % vs WebP),
- **WebP en fallback** (Safari ≤ 14 ne lisait pas AVIF),
- **JPEG en dernier recours** (vieux navigateurs).

On utilise `next/image` **à l'intérieur** comme primitive pour la
gestion du loader Vercel + responsive sizes, mais on l'enveloppe
dans `<picture>` pour le multi-format.

### Pourquoi BlurHash et pas seulement le blurDataURL Next.js ?

BlurHash est ~30 octets vs ~600 octets pour le blurDataURL base64
JPEG. Sur 50 médias par page (galerie journal), c'est 28 kB vs
30 octets × 50 = 1.5 kB économisés sur la première peinture.

### Pourquoi un override JSONB plutôt que des colonnes par option ?

- Évolutif : ajouter une nouvelle option (ex. `dpr` cap) ne demande
  pas de migration.
- Sparse : la grande majorité des médias n'a aucun override, on ne
  paie pas le coût des colonnes nullables.
- Lisible : un humain peut lire et éditer le bloc JSON dans la console
  admin.

### Pourquoi un storage adapter et pas du Vercel Blob direct ?

- **Tests** : adapter `local` permet aux tests Vitest de fonctionner
  sans aucun service externe.
- **Dev** : la fondatrice peut développer offline.
- **Migration** : si un jour on quitte Vercel pour Cloudflare R2 ou
  S3 direct, on swap l'adapter sans toucher au pipeline.

## Dépendances internes

```
              ┌──────────────────────┐
              │  src/components/     │
              │  media/MediaImage    │
              └────────┬─────────────┘
                       │ getMediaPublic()
                       ▼
              ┌──────────────────────┐
              │  src/lib/media/      │
              │  queries (DB layer)  │
              └────────┬─────────────┘
                       │ Drizzle / memoryStore
                       ▼
              ┌──────────────────────┐
              │  Postgres / memory   │
              └──────────────────────┘

              ┌──────────────────────┐
              │  /api/admin/media/*  │
              └────────┬─────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
  ┌───────────────┐         ┌─────────────────────┐
  │ pipeline/     │         │ storage/ (adapter)  │
  │ - image.ts    │         │ - localStorage      │
  │ - video.ts    │         │ - vercelBlob        │
  │ - audio.ts    │         │ - external          │
  └───────────────┘         └─────────────────────┘
```

## Frontières module

Le module **n'expose** vers l'extérieur que :

- les **3 composants React** (`<MediaImage>`, `<MediaVideo>`,
  `<MediaAudio>`),
- les **types** `Media`, `MediaVariant`, `MediaContext`,
- la **fonction RSC** `getMedia(idOrSlug)`,
- la **route publique** `GET /api/media/{id}`.

Tout le reste (storage adapter, pipeline, queue, schémas internes)
est **privé** au module et ne doit pas être importé hors de
`src/lib/media/`.
