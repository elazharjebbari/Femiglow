# 03 — Backend

## Vue d'ensemble

Le backend du module média s'articule autour de cinq surfaces :

1. **Routes API admin** (`/api/admin/media/*`) — CRUD, upload, régénération.
2. **Route API publique** (`/api/media/{id}`) — lecture cacheable.
3. **Route cron** (`/api/cron/media-optimize`) — worker pipeline.
4. **Pipeline** (`src/lib/media/pipeline/`) — fonctions pures
   `optimizeImage`, `optimizeVideo`, `optimizeAudio`.
5. **Storage adapter** (`src/lib/media/storage/`) — interface unique
   `local` / `vercelBlob` / `external`.

Toutes les routes admin sont derrière `requireAdmin` (iron-session) et
loggent un `audit_event` pour chaque mutation. Toutes les entrées
externes sont validées par Zod avant d'atteindre la couche queries.

## Routes API admin

### `POST /api/admin/media/upload`

Upload multipart d'un fichier source. Crée l'entrée `media` en
`status = pending` et un `media_jobs` `kind = 'optimize'`.

**Headers** :

- `Content-Type: multipart/form-data`
- `Cookie: __Secure-fg-admin=…` (iron-session)

**Champs form-data** :

| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| `file` | File | oui (si `source = upload`) | binaire |
| `url` | string | oui (si `source = external`) | URL HTTP(S) |
| `kind` | enum | oui | `image` / `video` / `audio` |
| `slug` | string | non | normalisé serveur si fourni |
| `alt` | string | oui | a11y |
| `caption` | string | non | |
| `credit` | string | non | |
| `tags[]` | string[] | non | noms de tags existants ou nouveaux |
| `quality_profile` | enum | non | défaut `inline` |
| `loading_strategy` | enum | non | défaut `viewport` |
| `is_hero` | boolean | non | défaut `false` |
| `overrides` | JSON string | non | bloc d'override (cf. `08-overrides.md`) |

**Validation** :

1. Taille max selon `kind` :
   - image : 25 MB
   - vidéo : 500 MB
   - audio : 50 MB
2. Magic bytes via `file-type` — refus si MIME ≠ MIME annoncé.
3. Slug normalisé (`slugify` interne, kebab-case ASCII, max 80 char).
4. Si `source = external` : check anti-SSRF via
   `lib/webhooks/anti-ssrf.ts` (rejet IP privée, IPv6 link-local, fichier
   local, schémas non HTTP(S)).
5. Si `slug` déjà présent (et `deleted_at IS NULL`) : 409 Conflict.
6. Si `phash` calculé matche un média existant à distance ≤ 5 bits :
   réponse 200 avec `{ duplicate: true, existing_id: 'me_xxx' }` — la
   fondatrice arbitre dans l'UI.

**Réponses** :

- `201 Created` :

  ```json
  {
    "id": "me_4k7m2n",
    "slug": "kit-principale",
    "status": "pending",
    "job_id": "mj_p9q3rs"
  }
  ```

- `400` validation Zod (détail dans `error.details`)
- `409` slug déjà pris ou doublon phash (avec `existing_id`)
- `413` payload trop volumineux
- `415` MIME refusé
- `429` rate-limit (cf. plus bas)

**Side effects** :

1. Upload du fichier source via le storage adapter actif.
2. `INSERT media (status='pending')`.
3. `INSERT media_jobs (kind='optimize', status='pending', next_attempt_at=now())`.
4. `INSERT audit_events (action='media.uploaded', actor=admin_id, meta={…})`.

### `GET /api/admin/media`

Liste paginée + filtres.

**Query string** :

| Param | Type | Notes |
|---|---|---|
| `q` | string | recherche full-text sur `slug`, `alt`, `caption` (ILIKE) |
| `kind` | enum | filtre image/vidéo/audio |
| `status` | enum | filtre par statut |
| `tag` | string | nom du tag |
| `is_hero` | boolean | |
| `unused` | boolean | médias sans usage |
| `cursor` | string | pagination keyset |
| `limit` | int | 20–100, défaut 50 |

**Réponse** :

```json
{
  "items": [{ "id": "me_…", "slug": "…", "kind": "image", "status": "ready", "thumbnail_url": "…", "size_bytes": 18420, "tags": [{"id":"mt_…","name":"kit"}], "usages_count": 3 }],
  "next_cursor": "me_xx_2026-04-12T08:11:00Z",
  "total": 124
}
```

### `GET /api/admin/media/{id}`

Détail complet (média + variantes + tags + usages + jobs récents).

### `PATCH /api/admin/media/{id}`

Met à jour métadonnées (`alt`, `caption`, `credit`, `tags`,
`quality_profile`, `loading_strategy`, `is_hero`, `overrides`).

Si `quality_profile`, `loading_strategy`, `is_hero` ou `overrides`
changent **et** que cela invalide les variantes existantes (ex.
nouveaux breakpoints), un job `regenerate` est planifié.

`audit_events` :

- `media.override_changed` si `overrides` change (avant/après diff).
- `media.metadata_updated` sinon.

### `DELETE /api/admin/media/{id}`

Soft delete : `UPDATE media SET deleted_at = now()`.

`?hard=true` (admin uniquement, demande confirmation côté UI) :
plannifie immédiatement un job `delete` qui supprime variantes + ligne
`media`.

`audit_events` : `media.deleted` avec `meta.soft = true|false`.

### `POST /api/admin/media/{id}/regenerate`

Insère un job `regenerate` `pending` (idempotent — si un
`regenerate pending` existe déjà, retourne 200 avec
`already_pending: true`).

**Body** :

```json
{ "reason": "config_change" | "manual" }
```

`audit_events` : `media.regenerated`.

### `POST /api/admin/media/tags`

CRUD léger sur les tags (`name`, `color`).

### `GET /api/admin/media/settings`

Renvoie la config globale par défaut (formats, breakpoints, qualités).

### `PATCH /api/admin/media/settings`

Modifie la config globale. **Attention** : si la config change, un job
`regenerate` est planifié pour **tous les médias** dont `overrides` ne
définit pas l'option modifiée. Confirmation explicite côté UI requise
("ré-encoder 124 médias ? cela coûtera ~12 min de cron").

## Route API publique

### `GET /api/media/{idOrSlug}`

Lecture publique (pas d'auth), JSON minimal pour le frontend qui n'est
pas en RSC.

**Headers de cache** :

- `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`
- `ETag: <hash>` (sha256 du payload)

**Réponse** :

```json
{
  "id": "me_4k7m2n",
  "slug": "kit-principale",
  "kind": "image",
  "alt": "kit principal posé sur le linge brodé",
  "caption": null,
  "blurhash": "LKO2?V%2Tw=w]~RBVZRi};RPxuwH",
  "palette": [{"r":214,"g":192,"b":172,"hex":"#d6c0ac","weight":0.42}],
  "width": 1600,
  "height": 1067,
  "duration_ms": null,
  "loading_strategy": "viewport",
  "is_hero": false,
  "overrides": {},
  "variants": [
    { "format": "avif", "breakpoint": "md", "width": 768, "height": 512, "url": "https://…/kit-principale-md.avif", "size_bytes": 18420 }
  ]
}
```

**Sécurité** :

- 404 si `deleted_at IS NOT NULL` ou `status != 'ready'`
  (sauf `passthrough` qui est lisible).
- Pas de PII.

## Route cron

### `POST /api/cron/media-optimize`

**Headers requis** :

```
Authorization: Bearer ${CRON_SECRET}
```

**Comportement** :

1. Claim atomique d'un job `pending` :

   ```sql
   UPDATE media_jobs
   SET status = 'in_progress',
       started_at = now(),
       attempt_count = attempt_count + 1
   WHERE id = (
     SELECT id FROM media_jobs
     WHERE status = 'pending' AND next_attempt_at <= now()
     ORDER BY created_at ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED
   )
   RETURNING *;
   ```

2. Selon `kind` :
   - `optimize` → télécharge la source, appelle `optimizeImage`/
     `optimizeVideo`/`optimizeAudio`, upload des variantes,
     `INSERT media_variants`, `UPDATE media SET status='ready'`,
     `UPDATE media_jobs SET status='done'`, `audit_event 'media.optimized'`.
   - `regenerate` → idem `optimize` mais supprime d'abord les
     anciennes variantes (Blob + DB).
   - `phash` → recalcule `phash` (si pipeline a évolué) sans toucher
     aux variantes.
   - `delete` → supprime les variantes Blob, supprime la ligne `media`
     (CASCADE), `audit_event 'media.deleted'` avec `soft=false`.

3. **En cas d'erreur** :
   - `attempt_count <= 3` → `status='pending'`,
     `next_attempt_at = now() + interval '1s' * pow(5, attempt_count)`
     (1s, 5s, 25s) — backoff exponentiel.
   - `attempt_count > 3` → `status='failed'`, alerte Sentry,
     `media.status='failed'`, `media.failure_reason = error.message`.

4. **Budget temps** : la fonction Vercel a 300 s max. On prend **un
   seul job** par tick (image ~3 s, vidéo jusqu'à 60 s). Si la queue
   grossit, augmenter la fréquence du cron.

5. **Concurrence** : `FOR UPDATE SKIP LOCKED` garantit qu'on peut
   exécuter plusieurs invocations parallèles sans double-traitement.

**Configuration `vercel.json`** :

```json
{
  "crons": [
    { "path": "/api/cron/media-optimize", "schedule": "* * * * *" }
  ]
}
```

## Pipeline d'optimisation

### `src/lib/media/pipeline/image.ts`

```ts
export async function optimizeImage(
  source: Buffer,
  config: ImageEncodingConfig,
): Promise<{ variants: VariantOutput[]; metadata: ImageMetadata }> {
  const meta = await sharp(source).metadata();
  const variants: VariantOutput[] = [];

  for (const breakpoint of config.breakpoints) {
    const targetWidth = Math.min(breakpoint.width, meta.width!);
    for (const format of config.formats) {
      const buf = await sharp(source)
        .resize(targetWidth, null, { withoutEnlargement: true })
        .toFormat(format, { quality: config.qualityFor(format, breakpoint) })
        .toBuffer();
      variants.push({ format, breakpoint: breakpoint.name, width: targetWidth, height: …, buffer: buf });
    }
  }

  // BlurHash : on encode le LQIP à partir de la version 32 px
  const lqip = await sharp(source).resize(32, 32, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(lqip.data), lqip.info.width, lqip.info.height, 4, 4);

  // Palette : k-means simple sur 64x64 px
  const palette = await extractPalette(source);

  // Perceptual hash 64 bits
  const phash = await computePhash(source);

  return {
    variants,
    metadata: { width: meta.width!, height: meta.height!, blurhash, palette, phash },
  };
}
```

**Configuration par profil** (cf. `06-optimisation-rendu.md`) :

| Profil | Breakpoints | Formats | Qualité AVIF / WebP / JPEG |
|---|---|---|---|
| `hero` | xs/sm/md/lg/xl/2xl | avif, webp, jpeg | 70 / 75 / 82 |
| `inline` | xs/sm/md/lg | avif, webp, jpeg | 60 / 70 / 75 |
| `thumb` | xs/sm | webp, jpeg | 50 / 60 / 65 |

### `src/lib/media/pipeline/video.ts`

Utilise `fluent-ffmpeg` + binaire `ffmpeg-static`.

```ts
export async function optimizeVideo(
  source: Buffer,
  config: VideoEncodingConfig,
): Promise<{ variants: VariantOutput[]; metadata: VideoMetadata }> {
  // 1. Probe : durée, dimensions
  const probe = await ffprobe(source);

  // 2. Poster (PNG → AVIF/WebP) extrait à t=1s
  const posterBuf = await ffmpegExtractFrame(source, '00:00:01');
  const posterVariants = await optimizeImage(posterBuf, IMAGE_POSTER_CONFIG);

  // 3. MP4 H.264 (compatibilité maximale)
  const mp4 = await ffmpegEncode(source, {
    codec: 'libx264', preset: 'medium', crf: 23,
    audio: 'aac', audioBitrate: '128k',
    maxWidth: 1280,
  });

  // 4. WebM VP9 (économie ~30% sur Chrome/Firefox/Edge)
  const webm = await ffmpegEncode(source, {
    codec: 'libvpx-vp9', deadline: 'good',
    audio: 'libopus', audioBitrate: '96k',
    maxWidth: 1280,
  });

  return {
    variants: [...posterVariants.variants, mp4, webm],
    metadata: { width: probe.width, height: probe.height, durationMs: probe.duration * 1000 },
  };
}
```

**Limites** :

- `maxWidth = 1280` par défaut (Phase 2 : multi-résolution selon profil).
- Pas de HLS / DASH (Phase 2).
- Audio extrait du conteneur, pas d'égalisation.

### `src/lib/media/pipeline/audio.ts`

```ts
export async function optimizeAudio(
  source: Buffer,
  config: AudioEncodingConfig,
): Promise<{ variants: VariantOutput[]; metadata: AudioMetadata }> {
  const meta = await parseBuffer(source); // music-metadata

  const mp3 = await ffmpegEncode(source, { codec: 'libmp3lame', bitrate: '128k' });
  const opus = await ffmpegEncode(source, { codec: 'libopus', bitrate: '96k' });

  return {
    variants: [mp3, opus],
    metadata: { durationMs: Math.round(meta.format.duration! * 1000), bitrateKbps: meta.format.bitrate! / 1000 },
  };
}
```

## Storage adapter

### Interface

`src/lib/media/storage/types.ts` :

```ts
export interface StorageAdapter {
  put(key: string, body: Buffer | ReadableStream, opts: { contentType: string; cacheControl?: string }): Promise<{ url: string; checksum: string }>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  signedUrl(key: string, ttlSeconds: number): Promise<string>;
}
```

### `local` adapter

`src/lib/media/storage/local.ts` — écrit dans
`apps/web/.media-store/` (gitignore). Utilisé en dev offline et en
tests Vitest.

```ts
export const localAdapter: StorageAdapter = {
  async put(key, body, { contentType }) {
    const path = join(MEDIA_LOCAL_ROOT, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    return {
      url: `/_media/${key}`, // exposé via le route handler GET /_media/[…path]
      checksum: sha256(body),
    };
  },
  async get(key) { return readFile(join(MEDIA_LOCAL_ROOT, key)); },
  async remove(key) { await unlink(join(MEDIA_LOCAL_ROOT, key)); },
  async signedUrl(key) { return `/_media/${key}`; },
};
```

### `vercelBlob` adapter

`src/lib/media/storage/vercel-blob.ts` — utilise le SDK
`@vercel/blob` (déjà dans le projet pour d'autres usages, sinon à
ajouter).

```ts
import { put, del, head } from '@vercel/blob';

export const vercelBlobAdapter: StorageAdapter = {
  async put(key, body, opts) {
    const { url } = await put(key, body, {
      access: 'public',
      contentType: opts.contentType,
      cacheControlMaxAge: 31_536_000, // 1 an, immutable
      addRandomSuffix: false,
    });
    return { url, checksum: sha256(body) };
  },
  async get(key) {
    const { url } = await head(key);
    return Buffer.from(await (await fetch(url)).arrayBuffer());
  },
  async remove(key) { await del(key); },
  async signedUrl(key, ttl) {
    // Vercel Blob public URLs sont stables ; pour usage privé, signer via JWT custom
    const token = await signMediaToken({ key, exp: Date.now() + ttl * 1000 });
    return `/api/media/blob/${encodeURIComponent(key)}?token=${token}`;
  },
};
```

### `external` (passthrough) adapter

Pour les URLs externes qu'on **ne veut pas** rapatrier (ex. logo
partenaire hébergé chez eux).

```ts
export const externalAdapter: StorageAdapter = {
  async put() { throw new Error('external is read-only'); },
  async get(url) {
    await ensureSafeUrl(url); // anti-SSRF
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`external fetch ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  },
  async remove() { /* no-op */ },
  async signedUrl(url) { return url; },
};
```

Quand `source = external`, le pipeline marque `status = 'passthrough'`
et **ne crée pas de variantes** : on rend l'URL telle quelle. Si la
fondatrice veut optimiser, elle re-uploade en local.

### Sélection

`src/lib/media/storage/index.ts` :

```ts
export function getStorage(): StorageAdapter {
  switch (env.MEDIA_STORAGE_DRIVER) {
    case 'local': return localAdapter;
    case 'vercelBlob': return vercelBlobAdapter;
    default:
      throw new Error(`Unknown MEDIA_STORAGE_DRIVER: ${env.MEDIA_STORAGE_DRIVER}`);
  }
}
```

`MEDIA_STORAGE_DRIVER` :

- dev / tests → `local`
- preview / prod → `vercelBlob`

## Sécurité

### Magic-bytes

`file-type` lit les premiers octets du buffer pour vérifier que le
MIME annoncé matche le contenu. Liste blanche :

```ts
const ALLOWED_MIMES_BY_KIND = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav'],
};
```

Refus si MIME hors liste OU si magic-bytes ≠ MIME annoncé → 415.

### Anti-SSRF (URL externes)

Réutilise `ensureSafeUrl` de `lib/webhooks/anti-ssrf.ts` :

- schémas autorisés : `https:` uniquement (sauf `http:` en dev).
- résolution DNS → refus si IP privée (RFC1918), loopback, link-local,
  CGN, multicast.
- timeout strict 10 s.

### Rate-limit

- `/api/admin/media/upload` : 30 req/min/IP via `lib/rate-limit.ts`
  (Redis Upstash en prod, mémoire en dev).
- Headers : `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.

### CSP

Les variantes Blob sont servies depuis `*.public.blob.vercel-storage.com`.
La CSP doit autoriser :

```
img-src 'self' data: blob: https://*.public.blob.vercel-storage.com;
media-src 'self' blob: https://*.public.blob.vercel-storage.com;
```

### Audit events

Tous les écrits passent par `logAuditEvent` (idem module admin) :

| Action | meta |
|---|---|
| `media.uploaded` | `media_id`, `kind`, `size_bytes`, `original_filename` |
| `media.optimized` | `media_id`, `variants_count`, `total_size_bytes`, `duration_ms` |
| `media.regenerated` | `media_id`, `reason` |
| `media.deleted` | `media_id`, `soft` |
| `media.metadata_updated` | `media_id`, `fields_changed` |
| `media.override_changed` | `media_id`, `before`, `after` |

## Variables d'environnement

```env
# .env
MEDIA_STORAGE_DRIVER=local            # local | vercelBlob
MEDIA_LOCAL_ROOT=./.media-store       # si driver=local
BLOB_READ_WRITE_TOKEN=…               # si driver=vercelBlob
MEDIA_MAX_UPLOAD_BYTES_IMAGE=26214400
MEDIA_MAX_UPLOAD_BYTES_VIDEO=524288000
MEDIA_MAX_UPLOAD_BYTES_AUDIO=52428800
MEDIA_SIGNED_URL_TTL_SECONDS=3600
MEDIA_PIPELINE_MAX_ATTEMPTS=4
MEDIA_PIPELINE_BACKOFF_BASE_SECONDS=5
CRON_SECRET=…                          # déjà existant
```

Validation par `src/env.ts` (Zod) au boot.

## Robustesse

### Idempotence

- L'upload **n'écrit la source qu'une fois** : si un `media_jobs`
  pending existe déjà pour `media_id`, on n'en crée pas un second.
- Le job `optimize` regarde `media.status` avant d'agir : si
  `ready` ou `failed`, il ne refait rien (sauf `regenerate`).
- Les uploads Blob utilisent `addRandomSuffix: false` + clé
  `media/{media_id}/{format}/{breakpoint}.{ext}` : un retry écrase
  la même clé sans dupliquer.

### Reprises

- `attempt_count` borné à 4 ; passé ce seuil le job est `failed`.
- Cron `/api/cron/media-recover` (hebdo) : repique les jobs `failed`
  des 7 derniers jours et les remet `pending` avec
  `attempt_count = 0`. Seulement déclenché manuellement par la
  fondatrice depuis l'UI admin (pas en automatique pour éviter les
  tempêtes).

### Cohérence

- Avant de marquer `media.status = 'ready'`, on vérifie que le nombre
  de variantes attendues matche le produit
  `len(formats) × len(breakpoints) (+ poster si vidéo)`. Sinon,
  `status = 'failed'` et `failure_reason = 'missing_variants'`.

### Observabilité

- Sentry breadcrumb à chaque étape du pipeline (download, encode,
  upload, db).
- Métriques exposées sur `/api/admin/media/health` (admin uniquement) :
  - jobs pending / in_progress / failed
  - durée moyenne par kind
  - dernière exécution cron
- Tracé `console.log` structuré (JSON) dans le cron.

## Rétention et purge

- Sources `upload` : conservées indéfiniment (utiles pour
  re-encodage).
- Soft-deleted depuis 30 j : purge auto (cron hebdo) qui appelle le
  job `delete`.
- Variantes orphelines (sans `media_id` parent) : purge mensuelle qui
  liste les clés Blob et compare à la table `media_variants`.

## Schéma des dossiers

```
src/
  app/api/
    admin/media/
      upload/route.ts
      [id]/route.ts
      [id]/regenerate/route.ts
      tags/route.ts
      settings/route.ts
      route.ts                   ← GET liste
    cron/
      media-optimize/route.ts
    media/
      [id]/route.ts              ← GET public
  lib/media/
    config.ts                    ← profils, breakpoints, qualités
    pipeline/
      image.ts
      video.ts
      audio.ts
      phash.ts
      palette.ts
      blurhash.ts
    storage/
      types.ts
      local.ts
      vercel-blob.ts
      external.ts
      index.ts                   ← getStorage()
    queue/
      claim.ts
      retry.ts
    queries/                     ← double-driver Drizzle/memory
      media.ts
      media-variants.ts
      media-jobs.ts
      media-tags.ts
      media-usages.ts
    types.ts                     ← Media, Variant, Overrides
    errors.ts
```
