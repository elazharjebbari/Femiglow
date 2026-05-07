# 04 — Frontend

## Vue d'ensemble

Trois composants React publics couvrent 95 % des usages :

- `<MediaImage>` — pour toute image.
- `<MediaVideo>` — pour les vidéos (autoplay muted, ou contrôles).
- `<MediaAudio>` — pour les pistes audio.

Ils s'utilisent par **`id`** (`me_xxx`) ou par **`slug`** (préféré
côté code car lisible : `<MediaImage slug="hero-rituel" />`).

Trois primitives privées les soutiennent :

- `<MediaPlaceholder>` — SVG fallback (cf. `07-lazy-loading.md`).
- `<MediaLazy>` — HOC qui implémente la stratégie de chargement.
- `useMediaInView`, `useNetworkInfo`, `useReducedMotion` — hooks.

Tout est rendu en **RSC par défaut**. Les parties interactives
(IntersectionObserver, contrôles vidéo) sont des Client Components
dédiés (`<MediaImageClient>`, `<MediaVideoClient>`).

## API publique du module

### `<MediaImage>`

```tsx
<MediaImage
  slug="hero-rituel"
  context="hero"           // hero | inline | thumb (override du profil DB si présent)
  sizes="(max-width: 768px) 100vw, 60vw"
  priority                 // shorthand pour fetchPriority='high' + loading='eager'
  className="rounded-2xl"
  fallback="/products/rituel-placeholder.svg"  // SVG par défaut si non fourni
/>
```

**Props** :

| Prop | Type | Défaut | Notes |
|---|---|---|---|
| `id` | string | — | `me_xxx`, exclusif avec `slug` |
| `slug` | string | — | exclusif avec `id` |
| `context` | enum | profil DB | `hero` / `inline` / `thumb` |
| `sizes` | string | calculé | attribut `<img sizes>`, fallback `100vw` |
| `priority` | boolean | `false` | force eager + fetchPriority high |
| `loading` | enum | DB | override de la `loading_strategy` |
| `fallback` | string | — | URL SVG placeholder si chargement échoue |
| `className` | string | — | passé au `<picture>` racine |
| `style` | CSSProperties | — | passé au `<picture>` racine |
| `alt` | string | DB.alt | override (rare, ex. multilingue) |
| `loader` | string | — | `next` / `cloudflare` / `imgix` (override) |
| `onLoad` | () => void | — | callback fade-in fini |

**Comportement de rendu** (RSC) :

```tsx
async function MediaImage({ slug, context = 'inline', sizes, priority, …rest }) {
  const media = await getMedia(slug);
  if (!media) return <MediaPlaceholder fallback={rest.fallback} />;

  const config = resolveConfig(media, context);
  const variants = pickVariants(media.variants, config);

  return (
    <MediaImageClient
      media={media}
      variants={variants}
      sizes={sizes ?? defaultSizesFor(context)}
      priority={priority || media.isHero}
      strategy={config.loadingStrategy}
      blurhash={media.blurhash}
      palette={media.palette}
      fallback={rest.fallback}
      {…rest}
    />
  );
}
```

`MediaImageClient` produit :

```tsx
<picture
  className={…}
  style={{
    backgroundColor: palette[0]?.hex ?? '#f3ede4',
    backgroundImage: `url("data:image/svg+xml,${blurSvg}")`,
    backgroundSize: 'cover',
    aspectRatio: `${width} / ${height}`,
  }}
>
  <source type="image/avif" srcSet={avifSrcset} sizes={sizes} />
  <source type="image/webp" srcSet={webpSrcset} sizes={sizes} />
  <img
    src={jpegFallbackUrl}
    srcSet={jpegSrcset}
    sizes={sizes}
    width={width}
    height={height}
    alt={alt}
    loading={effectiveLoading}
    fetchPriority={effectivePriority}
    decoding={priority ? 'sync' : 'async'}
    onLoad={(e) => fadeIn(e.currentTarget)}
  />
</picture>
```

**Notes** :

- Si `media.kind !== 'image'` → throw au build (RSC catché par le
  layout d'erreur).
- Si `media.status !== 'ready'` ET `media.status !== 'passthrough'` →
  rend `<MediaPlaceholder>` avec `aria-busy="true"`.
- Si pas de variants disponibles (pipeline pas fini) → idem.

### `<MediaVideo>`

```tsx
<MediaVideo
  slug="rituel-demo"
  poster                  // utilise le poster auto-généré
  autoplay muted loop     // shorthand pour la vidéo de fond
  controls={false}
  lazy="interaction"      // ou "viewport" / "idle"
/>
```

**Props** :

| Prop | Type | Défaut | Notes |
|---|---|---|---|
| `id` / `slug` | string | — | comme image |
| `poster` | boolean \| string | `true` | URL custom ou poster DB |
| `autoplay` | boolean | `false` | force `muted` |
| `muted` | boolean | `autoplay` | |
| `loop` | boolean | `false` | |
| `controls` | boolean | `true` | |
| `lazy` | enum | DB | `eager` / `viewport` / `idle` / `interaction` |
| `playsInline` | boolean | `true` | iOS |

**Stratégies lazy spéciales** :

- `interaction` → rend `<button>` cliquable avec poster + icône play ;
  au clic, swap pour `<video>` réel + `play()`.
- `viewport` → IntersectionObserver, `preload='metadata'` jusqu'à
  l'apparition, puis `preload='auto'`.
- `idle` → `requestIdleCallback` après le LCP.
- `eager` → `<video preload="auto" autoplay muted>` direct.

**Rendu** :

```tsx
<video
  poster={posterUrl}
  preload={preloadValue}
  muted={muted}
  loop={loop}
  controls={controls}
  playsInline={playsInline}
  width={width}
  height={height}
  className={className}
>
  <source src={webmUrl} type="video/webm" />
  <source src={mp4Url} type="video/mp4" />
  Ton navigateur ne supporte pas la lecture vidéo.
</video>
```

### `<MediaAudio>`

```tsx
<MediaAudio
  slug="meditation-guidee"
  controls
  preload="metadata"
/>
```

**Rendu** :

```tsx
<audio controls={controls} preload={preload}>
  <source src={opusUrl} type="audio/opus" />
  <source src={mp3Url} type="audio/mpeg" />
</audio>
```

## Hooks

### `useMediaInView(ref, opts?)`

Wrapper IntersectionObserver. Renvoie `{ inView: boolean, hasBeenInView: boolean }`.

```ts
export function useMediaInView<T extends Element>(
  ref: RefObject<T>,
  opts: { rootMargin?: string; threshold?: number; once?: boolean } = {},
): { inView: boolean; hasBeenInView: boolean }
```

Défauts : `rootMargin: '200px 0px'`, `threshold: 0.01`, `once: true`.

`200px` permet de pré-charger juste avant que l'élément entre dans le
viewport.

### `useNetworkInfo()`

```ts
export function useNetworkInfo(): {
  saveData: boolean;
  effectiveType: '2g' | '3g' | '4g' | undefined;
  downlink: number | undefined;
}
```

Lit `navigator.connection` (Chrome / Edge / Android), retourne des
défauts safe sur Safari / Firefox.

Utilisé par `<MediaImage>` pour basculer vers le profil `thumb` si
`saveData = true` ou `effectiveType ∈ {'slow-2g', '2g'}`.

### `useReducedMotion()`

```ts
export function useReducedMotion(): boolean
```

Lit `prefers-reduced-motion: reduce`. Si `true` :

- pas de fade-in
- pas d'autoplay vidéo (même si `autoplay` prop)
- pas de transitions sur swap srcset

## Intégration RSC

### `getMedia(idOrSlug)`

`src/lib/media/queries/index.ts` :

```ts
import 'server-only';

export async function getMedia(idOrSlug: string): Promise<Media | null> {
  const isId = idOrSlug.startsWith('me_');
  return isId
    ? findMediaById(idOrSlug)
    : findMediaBySlug(idOrSlug);
}
```

**Cache** : utilise `unstable_cache` de Next avec :

- `tags: ['media', `media:${idOrSlug}`]` — invalidé par
  `revalidateTag('media:slug')` lors d'un PATCH ou regenerate.
- `revalidate: 3600` — défense en profondeur.

```ts
export const getMedia = unstable_cache(
  async (idOrSlug: string) => { /* … */ },
  ['media-by-id-or-slug'],
  { tags: ['media'], revalidate: 3600 },
);
```

### Tracking d'usage

Côté serveur, à chaque appel de `<MediaImage>` :

```ts
// Best-effort, fire-and-forget
queueMicrotask(() => {
  recordUsage({
    media_id: media.id,
    usage_type: inferUsageType(),
    route: getCurrentRoute(),
    component: '<MediaImage>',
    context,
  });
});
```

`recordUsage` fait un `INSERT … ON CONFLICT (media_id, route, component)
DO UPDATE SET last_seen_at = now()`. Aucun blocage du rendu.

En **dev seulement**, log dans la console pour aider la fondatrice à
voir où chaque média est consommé.

### `getMediaPublic(idOrSlug)` — variante client-side

Pour les pages qui utilisent `'use client'`, on expose une fonction
`getMediaPublic` qui appelle `GET /api/media/{id}` et bénéficie du
cache HTTP `s-maxage=86400`.

## SVG placeholder fallback

Le **placeholder par défaut** est un SVG inline (sans requête réseau)
qui occupe l'aspect ratio attendu. Cf. `07-lazy-loading.md`.

```tsx
function MediaPlaceholder({ width, height, fallback, label }: Props) {
  if (fallback) {
    return <img src={fallback} width={width} height={height} alt={label ?? ''} aria-hidden="true" />;
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label ?? 'image en cours de chargement'}>
      <rect width="100%" height="100%" fill="#f3ede4" />
      <g fill="none" stroke="#d6c0ac" strokeWidth="2">
        <path d={…feminine ornamental motif…} />
      </g>
    </svg>
  );
}
```

Le **fallback URL** est typiquement un SVG du dossier
`apps/web/public/products/`, `public/avis/`, etc.

**Stratégie de remplacement** :

1. Le SVG placeholder est rendu en première peinture (HTML serveur).
2. Le navigateur pré-charge la variante optimisée (LQIP via BlurHash
   en background-image inline).
3. Quand l'`<img>` final décode (`onLoad`), une transition
   `opacity 200ms` masque le SVG.
4. Si le réseau est trop lent (timeout 8 s ou
   `navigator.connection.effectiveType in ['slow-2g', '2g']` et
   `saveData`) → on garde le SVG indéfiniment, l'utilisateur peut
   tap pour forcer le chargement.

## Fade-in transition

```css
@layer media {
  .media-img {
    opacity: 0;
    transition: opacity 200ms ease-out;
  }
  .media-img.is-loaded {
    opacity: 1;
  }
  @media (prefers-reduced-motion: reduce) {
    .media-img { transition: none; opacity: 1; }
  }
}
```

```tsx
function fadeIn(img: HTMLImageElement) {
  img.classList.add('is-loaded');
}
```

## Accessibilité

- `alt` est **obligatoire** au niveau de la base (NOT NULL). Le
  composant ne le rend pas optionnel.
- Si l'image est purement décorative, la fondatrice peut explicitement
  passer `alt=""` (chaîne vide acceptée).
- `<MediaVideo>` sans `controls` ET avec `autoplay` rend automatiquement
  un attribut `aria-label` dérivé du caption.
- `<MediaAudio>` sans `controls` est interdit (lint rule custom),
  car invisible et inaccessible.
- jest-axe en CI : 0 violation tolérée sur les pages qui consomment
  les composants media (cf. `09-tests.md`).

## Performance

### LCP

- Si une image est marquée `is_hero=true` ou si son `context='hero'`,
  le composant émet automatiquement :
  - `<link rel="preload" as="image" imagesrcset="…" imagesizes="…">` dans
    le `<head>` via `next/script` ou un `<link>` injecté via le metadata
    layout.
  - `loading="eager"`, `fetchpriority="high"`, `decoding="sync"`.

- Pour atteindre LCP ≤ 2.0 s mobile p75, on **inline le BlurHash en
  background-image** : la zone est déjà colorée avant la requête
  réseau de la version finale.

### CLS

- `width` et `height` sont **toujours** rendus sur `<img>` et
  `<video>` (provenant de `originalWidth`/`originalHeight`).
- `aspect-ratio` CSS est défini sur le `<picture>` parent.
- Le SVG placeholder occupe l'espace exact même avant chargement.

### TTFB / FCP

- Le rendu RSC évite les requêtes XHR côté client : les variantes
  sont injectées directement dans le HTML.
- Le `<picture>` est ~3 lignes HTML, faible overhead.

## Connexion au reste de l'app

### Pages qui consomment

| Page / composant | Médias attendus |
|---|---|
| `/` (home hero) | `hero-home` (image), `hero-home-mobile` (art-direction) |
| `/rituel` | `hero-rituel`, illustrations inline |
| `/journal` | thumbnails articles |
| `/kit` | photos produits |
| `/maison` | photos lieu |
| `/admin/leads/[id]` | avatars uploadés (si Phase 2 inclut profils) |

### Replacement progressif

Phase 1 : tous les `<img src="/products/xxx.svg" />` actuels sont
remplacés par `<MediaImage slug="xxx" fallback="/products/xxx.svg" />`.
Tant que le pipeline n'a pas généré les variantes, le SVG s'affiche.
Quand `status='ready'`, la prochaine requête utilise les variantes —
**aucun changement de markup** pour la fondatrice.

### Composants existants à migrer

Liste auditée par `pnpm exec tsx scripts/audit-media-usage.ts` :

```bash
src/app/page.tsx                       (3 <img>)
src/app/(public)/rituel/page.tsx       (5 <img>)
src/app/(public)/journal/[slug]/page.tsx (1 <img>)
src/components/marketing/Hero.tsx      (1 <img>)
src/components/marketing/ProductCard.tsx (1 <img>)
src/components/avis/AvisCard.tsx       (1 <img>)
…
```

Migration : `MED-070` à `MED-082` du plan d'action.

## Erreurs et logs

- En dev, les erreurs RSC (`getMedia` retourne `null`) sont rendues
  comme un `<MediaPlaceholder label="média introuvable: hero-rituel">`
  avec un badge rouge en coin.
- En prod, même comportement mais sans badge.
- Sentry capture l'erreur avec `media.slug`, `media.id`, `route`.

## Module exports

`src/lib/media/index.ts` :

```ts
export { MediaImage } from './components/MediaImage';
export { MediaVideo } from './components/MediaVideo';
export { MediaAudio } from './components/MediaAudio';
export { MediaPlaceholder } from './components/MediaPlaceholder';
export { useMediaInView } from './hooks/useMediaInView';
export { useNetworkInfo } from './hooks/useNetworkInfo';
export { useReducedMotion } from './hooks/useReducedMotion';
export { getMedia } from './queries';
export type { Media, MediaVariant, MediaContext, MediaOverrides } from './types';
```

Le reste (storage, pipeline, queue) **n'est pas exporté** — privé.
