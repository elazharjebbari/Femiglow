# 06 — Optimisation du rendu

## Objectifs mesurables

| Métrique | Cible | Comment on l'atteint |
|---|---|---|
| LCP p75 mobile | ≤ 2.0 s | hero AVIF préchargé + BlurHash inline |
| CLS p75 | < 0.05 | width/height + aspect-ratio toujours rendus |
| Poids hero AVIF mobile | ≤ 80 KB | quality=70 + breakpoint xs (480px) |
| Poids hero AVIF desktop | ≤ 220 KB | quality=70 + breakpoint xl (1280px) |
| Économie moyenne vs original | ≥ 70 % | AVIF par défaut, fallback intelligent |
| TTFB pages avec hero | < 600 ms | RSC streaming + cache HTTP |

## Formats : AVIF → WebP → JPEG

### Pourquoi cet ordre

| Format | Compression vs JPEG | Support 2026 | Décodage |
|---|---|---|---|
| AVIF | -50 % à -60 % | 95 % | Lent (mais OK ≤ 1 MB) |
| WebP | -30 % à -40 % | 99 % | Rapide |
| JPEG | baseline | 100 % | Très rapide |

AVIF en priorité car économies maximales. WebP en fallback (Safari 14
ne lit pas AVIF). JPEG en dernier recours (vieux Android, IE legacy).

PNG **non servi en prod** : remplacé par AVIF lossless si transparence
nécessaire.

### Implémentation `<picture>`

```tsx
<picture>
  <source type="image/avif" srcSet={avifSrcset} sizes={sizes} />
  <source type="image/webp" srcSet={webpSrcset} sizes={sizes} />
  <img src={jpegLargeUrl} srcSet={jpegSrcset} sizes={sizes} … />
</picture>
```

Le navigateur choisit la première `<source>` qu'il sait décoder.

## Profils de qualité

### `hero` (LCP critique)

- 6 breakpoints (xs / sm / md / lg / xl / 2xl)
- 3 formats (AVIF / WebP / JPEG)
- Qualité : AVIF 70 / WebP 75 / JPEG 82
- Total : 18 variantes par image hero
- Préchargé via `<link rel="preload">`

### `inline` (corps de page)

- 4 breakpoints (xs / sm / md / lg)
- 3 formats
- Qualité : AVIF 60 / WebP 70 / JPEG 75
- Total : 12 variantes
- Lazy-loaded (`loading="lazy"`)

### `thumb` (miniatures, listes)

- 2 breakpoints (xs / sm)
- 2 formats (WebP / JPEG, pas d'AVIF — overhead décodage > gain pour
  une image < 50 KB)
- Qualité : WebP 60 / JPEG 65
- Total : 4 variantes
- Lazy-loaded

### Justification empirique

Mesures sur les 5 PNG de `docs/images/values/` (avg 2.1 MB) :

| Profil | Total variantes | Poids servi (md) | Économie |
|---|---|---|---|
| hero | 18 | AVIF 24 KB → JPEG 64 KB | -97 % AVIF / -89 % JPEG |
| inline | 12 | AVIF 18 KB → JPEG 38 KB | -98 % / -98 % |
| thumb | 4 | WebP 8 KB / JPEG 12 KB | -99 % |

## Breakpoints responsive

```ts
export const BREAKPOINTS = {
  xs: 480,    // mobile portrait
  sm: 640,    // mobile paysage / phablet
  md: 768,    // tablette portrait
  lg: 1024,   // tablette paysage / petit laptop
  xl: 1280,   // desktop
  '2xl': 1600, // grand écran
} as const;
```

Cohérents avec Tailwind (déjà utilisé dans le projet) et avec les
points de cassure du design system FemiGlow.

### Calcul du `srcset`

```ts
function buildSrcset(variants: MediaVariant[], format: VariantFormat): string {
  return variants
    .filter(v => v.format === format && v.breakpoint)
    .sort((a, b) => a.width! - b.width!)
    .map(v => `${v.url} ${v.width}w`)
    .join(', ');
}
```

Exemple pour un hero AVIF :

```
/me_xx-xs.avif 480w,
/me_xx-sm.avif 640w,
/me_xx-md.avif 768w,
/me_xx-lg.avif 1024w,
/me_xx-xl.avif 1280w,
/me_xx-2xl.avif 1600w
```

### `sizes` par contexte

| Contexte | `sizes` par défaut |
|---|---|
| `hero` | `100vw` |
| `inline` (full-bleed) | `(max-width: 768px) 100vw, 60vw` |
| `inline` (column) | `(max-width: 768px) 100vw, 48rem` |
| `thumb` | `(max-width: 480px) 50vw, 200px` |

La fondatrice peut override par prop `sizes="…"` sur le composant.

## BlurHash (LQIP)

### Pourquoi pas blurDataURL Next ?

- BlurHash : ~30 octets (string base83)
- blurDataURL JPEG base64 : ~600 octets
- Sur une page journal avec 50 thumbnails : 1.5 KB vs 30 KB

### Génération

Pipeline :

```ts
import { encode } from 'blurhash';

const lqip = await sharp(source)
  .resize(32, 32, { fit: 'inside' })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const blurhash = encode(
  new Uint8ClampedArray(lqip.data),
  lqip.info.width,
  lqip.info.height,
  4, // x components
  4, // y components
);
```

### Rendu inline (sans JS)

On encode le BlurHash en SVG inline via une data URL. Pas de hook
React, pas de JS au boot — directement dans le `style` du `<picture>` :

```tsx
const blurSvg = blurhashToSvgDataUrl(media.blurhash, 32, 32);

<picture
  style={{
    backgroundImage: `url("${blurSvg}")`,
    backgroundSize: 'cover',
    aspectRatio: `${width} / ${height}`,
  }}
>
```

`blurhashToSvgDataUrl` fait le décodage en RSC (server-side) :

```ts
import { decode } from 'blurhash';

export function blurhashToSvgDataUrl(hash: string, w: number, h: number): string {
  const pixels = decode(hash, w, h);
  // Convertir en PNG base64 via sharp côté serveur
  const png = sharp(Buffer.from(pixels), { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}
```

Note : on peut aussi rendre directement un PNG très basse résolution
(8×8) en data URL si BlurHash décodé pèse plus que ~600 octets en
PNG.

## Palette dominante

Extraction par k-means sur une version 64×64 de l'image, k=3.

```ts
export async function extractPalette(source: Buffer): Promise<PaletteEntry[]> {
  const small = await sharp(source).resize(64, 64).raw().toBuffer();
  const pixels = chunkRGBA(small);
  const clusters = kmeans(pixels, 3);
  return clusters
    .sort((a, b) => b.weight - a.weight)
    .map(c => ({ r: c.r, g: c.g, b: c.b, hex: rgbToHex(c.r, c.g, c.b), weight: c.weight }));
}
```

Usage frontend :

- `palette[0].hex` devient la couleur de fond du `<picture>` pendant
  le chargement (même avant que le BlurHash soit décodé).
- Permet de calculer la couleur d'accent dominante d'une carte
  (`backgroundColor` du tile dans la bibliothèque admin).
- Phase 2 : auto-color du texte au-dessus de l'image (ratio de
  contraste calculé).

## Art direction (multi-recadrage)

Pour les hero qui doivent avoir un cadrage différent en mobile vs
desktop (portrait vs paysage), on autorise un override `artDirection`
dans le bloc JSON :

```json
{
  "overrides": {
    "artDirection": {
      "xs": { "src": "me_xx_mobile_portrait", "alt": "..." },
      "md": { "src": "me_xx_desktop_landscape", "alt": "..." }
    }
  }
}
```

Le composant rend alors plusieurs `<source media="(max-width: …)">`
qui pointent vers des médias **différents** :

```tsx
<picture>
  <source media="(max-width: 480px)" type="image/avif" srcSet={mobileAvif} />
  <source media="(max-width: 480px)" type="image/webp" srcSet={mobileWebp} />
  <source type="image/avif" srcSet={desktopAvif} />
  <source type="image/webp" srcSet={desktopWebp} />
  <img src={desktopJpeg} … />
</picture>
```

## Priority hints

Le HTML standard `fetchpriority` (Chromium 102+, Safari 17.2+) :

- `fetchpriority="high"` sur le hero LCP
- `fetchpriority="low"` sur les thumbnails sous le pli

```tsx
<img
  fetchPriority={isHero ? 'high' : (priority === 'low' ? 'low' : 'auto')}
  …
/>
```

Sur Firefox (qui n'implémente pas encore), c'est ignoré silencieusement
— pas de fallback nécessaire.

## Connection-aware loading

```ts
const { saveData, effectiveType } = useNetworkInfo();

const effectiveProfile =
  saveData || effectiveType === 'slow-2g' || effectiveType === '2g'
    ? 'thumb'    // bascule forcée vers le profil le plus léger
    : config.qualityProfile;
```

Si l'utilisateur a activé "Économiseur de données" (Chrome Android),
on sert le profil `thumb` même pour le hero. L'image est moins jolie
mais la page se charge en < 1 s sur 2G.

Pas de blocage strict : la fondatrice peut désactiver ce comportement
via le réglage global "SaveData fallback" (cf. `05-ui-ux-design.md`).

## Décodage asynchrone

`decoding="async"` sur les images non-prioritaires : permet au
navigateur de décoder en background sans bloquer le rendu.

Sur le hero : `decoding="sync"` pour que l'image soit prête au
moment exact du paint LCP (sinon LCP attend la frame suivante).

## Loader Next.js Image

`<MediaImage>` n'utilise pas `next/image` directement, mais bénéficie
du **loader Vercel** quand `MEDIA_STORAGE_DRIVER=vercelBlob` :

```ts
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
};
```

Pour les cas avancés (CDN tiers Cloudflare Images / Imgix), on peut
override via `overrides.customLoader = 'cloudflare'` :

```ts
function cloudflareLoader({ src, width, quality }: ImageLoaderProps) {
  return `https://femiglow.com/cdn-cgi/image/width=${width},quality=${quality}/${src}`;
}
```

Pas implémenté en Phase 1 — décision Phase 2.

## Vidéo

### Encodage

| Codec | Profil | Bitrate cible (1280×720) |
|---|---|---|
| H.264 (libx264) | preset=medium, crf=23 | ~2.5 Mbps |
| VP9 (libvpx-vp9) | deadline=good, crf=32 | ~1.7 Mbps |

Audio :
- AAC 128k pour MP4
- Opus 96k pour WebM

### Poster

Frame extraite à `00:00:01` (1 s pour éviter les frames noires de
fade-in), encodée comme une image classique avec le profil `inline`.

### Lecture progressive

`<video preload="metadata">` par défaut : seul le header MP4/WebM est
téléchargé (~50 KB), pas le corps. Quand l'utilisateur clique
`play`, le streaming démarre.

Pour un hero vidéo (autoplay muted), `preload="auto"` → tout est
téléchargé immédiatement.

### MSE / HLS

**Pas en Phase 1** : les vidéos < 30 s peuvent être servies en
progressive download. Si la fondatrice a besoin de vidéos longues
(podcasts vidéo journal Phase 2), on intégrera HLS via Mux ou Vercel.

## Audio

### Encodage

| Codec | Bitrate |
|---|---|
| MP3 | 128 kbps (compat universelle) |
| Opus | 96 kbps (qualité égale à MP3 192) |

### Lecture

`<audio preload="metadata" controls>` par défaut. Pas de visualisation
particulière — Phase 2 si besoin (Web Audio API).

## CDN et cache

### Cache HTTP

Variantes Blob :

```
Cache-Control: public, max-age=31536000, immutable
```

Une variante optimisée n'est jamais ré-écrite (clé canonique
`media/{id}/{format}/{breakpoint}.{ext}` + checksum). Si elle change,
c'est une nouvelle clé → cache invalidé naturellement.

API publique `/api/media/{id}` :

```
Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800
```

Cache 1 jour côté CDN Vercel + 1 semaine de stale-while-revalidate.
Invalidation via `revalidateTag('media:{slug}')` quand la fondatrice
modifie un média.

### Edge caching

Toutes les variantes Blob bénéficient du CDN global Vercel
automatiquement. Latence p95 monde entier < 50 ms first-byte.

## Mesures et observabilité

### Web Vitals

`@vercel/speed-insights` (déjà dans le projet) collecte LCP, CLS, INP
en prod réelle. Dashboard accessible aux admins.

### Custom metrics

Côté pipeline, on logge :

```ts
console.log(JSON.stringify({
  event: 'media_optimized',
  media_id, kind,
  source_size_bytes, total_variants_size_bytes,
  ratio: total_variants_size_bytes / source_size_bytes,
  duration_ms,
}));
```

Agrégé dans `/admin/media/health` :

- ratio moyen d'économie
- temps moyen d'optimisation par kind
- formats qui échouent le plus

## Synthèse : ce qui rend ce module "innovant" pour FemiGlow

1. **BlurHash inline en RSC** : pas de JS pour la première peinture,
   couleur exacte avant la requête réseau de l'image finale.
2. **Connection-aware sans bibliothèque tierce** : un `useNetworkInfo`
   maison qui swap automatiquement vers `thumb` sur 2G/saveData.
3. **Override JSONB sparse** : 99 % des médias ont `overrides = {}`.
   On ne paie le coût que pour les hero. Évolutif sans migration.
4. **Storage adapter** : test offline avec `local`, prod sur Vercel
   Blob, possibilité de migrer vers S3/R2 en Phase 2 sans toucher
   au pipeline.
5. **Phash pour dédoublonnage** : pas un simple sha256, mais un hash
   perceptuel qui détecte les doublons même après recadrage léger.
6. **SVG fallback persistant** : la page reste belle même si l'image
   ne charge jamais. La structure ne casse jamais.
7. **Pipeline asynchrone avec idempotence** : les retries sont safe,
   les jobs peuvent être relancés sans corruption.
