# 07 — Lazy-loading

## Stratégies disponibles

Quatre stratégies, choisies par média (config DB) ou par contexte
d'usage (prop du composant).

| Stratégie | Quand l'image se charge | Cas typique |
|---|---|---|
| `eager` | immédiatement, en parallèle du HTML | hero LCP |
| `viewport` | quand le tile entre dans le viewport (200 px d'avance) | inline corps de page |
| `idle` | quand le navigateur est `requestIdleCallback` | sidebar, footer, sous le pli profond |
| `interaction` | sur clic / hover / focus | vidéos pesantes, galeries cliquables |

## Règle absolue : hero opt-out

> Si `is_hero = true` OU `context = 'hero'` OU `priority = true`,
> le composant **ignore** la `loading_strategy` et force :
> - `loading="eager"`
> - `fetchpriority="high"`
> - `decoding="sync"`
> - `<link rel="preload" as="image">` injecté dans le `<head>`

**Pas d'exception**, même si la fondatrice met `loading_strategy = 'idle'`
dans la DB. C'est une garantie LCP : on ne peut pas dégrader le LCP
par accident en éditant un média.

Pour défaire le hero behavior, il faut explicitement passer
`is_hero = false` ET `priority` non passé.

## Implémentation

### `eager`

```tsx
<img
  src={…}
  srcSet={…}
  loading="eager"
  fetchPriority={isHero ? 'high' : 'auto'}
  decoding={isHero ? 'sync' : 'async'}
/>
```

Pas de wrapping, pas d'IntersectionObserver. Le navigateur fait son
travail.

### `viewport`

Côté client (Client Component `<MediaImageClient>`), on initialise
l'élément avec `loading="lazy"` (natif) et un `data-src` :

```tsx
'use client';

function MediaImageClient({ srcset, sizes, … }: Props) {
  const ref = useRef<HTMLImageElement>(null);
  const { hasBeenInView } = useMediaInView(ref, { rootMargin: '200px 0px' });

  return (
    <img
      ref={ref}
      src={hasBeenInView ? jpegFallbackUrl : transparentPixel}
      srcSet={hasBeenInView ? srcset : undefined}
      sizes={sizes}
      loading="lazy"
      decoding="async"
      width={width}
      height={height}
      style={{
        backgroundImage: `url("${blurSvgDataUrl}")`,
        backgroundSize: 'cover',
      }}
      onLoad={(e) => e.currentTarget.classList.add('is-loaded')}
    />
  );
}
```

`transparentPixel` = `data:image/gif;base64,R0lGODlhAQABAAAAACw=`
(43 octets), permet à `<img>` d'avoir un `src` valide sans charger
quoi que ce soit.

`loading="lazy"` natif est l'optimisation côté navigateur ; on
**double** avec IntersectionObserver pour gérer les anciens
navigateurs et pour avoir le `rootMargin` de 200 px qu'on ne peut pas
configurer en `loading="lazy"` natif.

### `idle`

```tsx
function MediaImageClient({ … }: Props) {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (typeof requestIdleCallback === 'function') {
      const handle = requestIdleCallback(() => setShouldLoad(true), { timeout: 4000 });
      return () => cancelIdleCallback(handle);
    }
    // fallback navigateurs sans requestIdleCallback (Safari < 17)
    const t = setTimeout(() => setShouldLoad(true), 1500);
    return () => clearTimeout(t);
  }, []);

  return <img src={shouldLoad ? jpegFallbackUrl : transparentPixel} … />;
}
```

`timeout: 4000` garantit que l'image se charge au plus tard 4 s après
le mount, même si le main thread est saturé.

### `interaction`

Le média n'est **jamais** chargé tant que l'utilisateur n'interagit
pas. Affichage par défaut : SVG fallback ou BlurHash plein écran avec
icône `play` ou `eye` cliquable.

```tsx
function MediaInteraction({ media, variants }: Props) {
  const [activated, setActivated] = useState(false);

  if (!activated) {
    return (
      <button
        type="button"
        onClick={() => setActivated(true)}
        onMouseEnter={() => preloadVariants(variants)}
        onFocus={() => preloadVariants(variants)}
        className="relative w-full h-full group"
        aria-label={`Voir ${media.alt}`}
      >
        <MediaPlaceholder fallback={fallbackUrl} blurhash={media.blurhash} />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40">
          {media.kind === 'video' ? <PlayIcon /> : <EyeIcon />}
        </div>
      </button>
    );
  }

  return <MediaImageEager … />;
}
```

`preloadVariants` fait un `<link rel="prefetch">` au hover/focus pour
accélérer la transition au clic.

## SVG placeholder fallback

### Principe

Avant toute chose, le composant rend **un placeholder** qui occupe
l'aspect ratio attendu. Trois niveaux de fallback :

1. **SVG inline** (préféré) : zéro requête réseau, généré côté serveur
   à partir de la palette dominante.
2. **SVG externe** (du dossier `apps/web/public/products/`,
   `public/avis/`, etc.) : référencé par `fallback="/products/xxx.svg"`.
3. **BlurHash** : une couleur floue dérivée de l'image réelle.

### Niveau 1 — SVG inline généré

Pour chaque image, on génère côté pipeline un SVG très léger :

```svg
<svg viewBox="0 0 1280 800" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#d6c0ac" />
      <stop offset="100%" stop-color="#f3ede4" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <circle cx="50%" cy="50%" r="80" fill="#fff" fill-opacity="0.18" />
</svg>
```

Le gradient utilise les couleurs du `palette` extraites par le
pipeline. L'élément central est un motif décoratif neutre (cercle,
losange, ondulation) qui rappelle l'esthétique FemiGlow.

Stocké dans `media.overrides.placeholderSvg` (optionnel, dérivé
automatique).

### Niveau 2 — SVG externe (existant)

Les SVG actuels du projet (`apps/web/public/products/rituel.svg`,
`apps/web/public/avis/...`) sont **conservés** et utilisés comme
fallback explicite via la prop `fallback` du composant.

```tsx
<MediaImage slug="hero-rituel" fallback="/products/rituel-hero.svg" />
```

Quand le pipeline n'a pas (encore) traité l'image, ou quand le réseau
est inaccessible, le SVG s'affiche à la bonne taille avec un design
soigné.

### Niveau 3 — BlurHash

Si pas de SVG fallback fourni et pas de palette, on tombe sur le
BlurHash (~30 octets). Décodé côté serveur en PNG data URL.

### Stratégie de remplacement progressif

```
Étape 1 (HTML serveur)
  ┌──────────────────────────┐
  │  SVG inline ou fallback  │
  │  (déjà rendu, 0 ms)      │
  └──────────────────────────┘

Étape 2 (CSS background)
  ┌──────────────────────────┐
  │  BlurHash via background │
  │  (rendu en RSC, 0 ms)    │
  └──────────────────────────┘

Étape 3 (image décodée)
  ┌──────────────────────────┐
  │  <img> qui fait fade-in  │
  │  opacity 0 → 1 (200 ms)  │
  └──────────────────────────┘
```

Si l'image ne charge jamais (réseau cassé, 404, timeout) :

- L'`<img>` reste à `opacity: 0` (elle n'a jamais émis `onLoad`).
- Le SVG / BlurHash reste visible en background.
- La structure de la page **n'est pas cassée**.

## Configuration du fade-in

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
    .media-img {
      transition: none;
    }
    .media-img.is-loaded,
    .media-img:not(.is-loaded) {
      opacity: 1; /* on n'anime pas, mais on rend visible quand même */
    }
  }
}
```

**Détail subtil** : avec `prefers-reduced-motion`, on rend l'image
opaque même avant le `is-loaded` pour éviter qu'un visiteur
sensible aux animations voie un blanc qui n'apparaît jamais. Le
trade-off : il peut voir une demi-image en cours de chargement
progressif (typique JPEG progressive). Acceptable.

## Hero opt-out — exemples

### Hero home

```tsx
// apps/web/src/app/page.tsx
export default function HomePage() {
  return (
    <main>
      <MediaImage
        slug="hero-home"
        priority                          // → eager + fetchpriority high
        sizes="100vw"
        className="w-full h-screen object-cover"
        fallback="/products/hero-home.svg"
      />
      …
    </main>
  );
}
```

DB :

```json
{
  "is_hero": true,
  "loading_strategy": "eager",
  "quality_profile": "hero"
}
```

### Hero rituel (avec art direction)

```tsx
<MediaImage
  slug="hero-rituel"
  priority
  sizes="100vw"
  fallback="/products/hero-rituel.svg"
/>
```

DB :

```json
{
  "is_hero": true,
  "overrides": {
    "artDirection": {
      "xs": { "src": "hero-rituel-mobile" },
      "md": { "src": "hero-rituel-desktop" }
    }
  }
}
```

## Lazy avancé : galeries

### Galerie journal

50 thumbnails dans une page d'archives. Stratégie `viewport` est
parfaite, mais on peut affiner :

- Les 6 premières (au-dessus du pli) → `loading_strategy = 'viewport'`
  avec `rootMargin: '0px'` (chargement immédiat à l'arrivée).
- Les 6–24 (sous le pli proche) → `viewport` avec
  `rootMargin: '600px 0px'` (anticipation).
- Les 24+ → `loading_strategy = 'idle'`.

Implémenté via override per-média ou via prop dans le composant
parent qui boucle sur les médias.

### Galerie kit (interactive)

Galerie d'images haute résolution (5–10 photos). Vue par défaut :
thumbnails à `viewport`. Click sur une thumbnail → ouvre une lightbox
avec stratégie `interaction` (charge la HD au clic).

## Vidéo lazy

### Vidéo de fond hero (autoplay muted)

```tsx
<MediaVideo slug="hero-rituel-bg" autoplay muted loop lazy="eager" />
```

`preload="auto"`, démarre dès que possible.

### Vidéo dans un article

```tsx
<MediaVideo slug="meditation-guidee" controls lazy="interaction" />
```

Affiche le poster + bouton play. Pas de download de la vidéo tant
que l'utilisateur ne clique pas.

### Vidéo sous le pli

```tsx
<MediaVideo slug="rituel-explanation" controls lazy="viewport" />
```

`preload="metadata"` jusqu'à ce que l'élément approche le viewport,
puis `preload="auto"`.

## Audio lazy

L'audio est **toujours** `lazy="interaction"` par défaut. Personne ne
veut télécharger un MP3 sans avoir cliqué.

```tsx
<MediaAudio slug="podcast-ep1" controls />
```

`preload="none"` natif HTML5.

## Hooks détaillés

### `useMediaInView`

```ts
import { useEffect, useRef, useState } from 'react';

interface Options {
  rootMargin?: string;
  threshold?: number;
  once?: boolean; // si true, observe seulement la première fois
}

export function useMediaInView<T extends Element>(
  ref: React.RefObject<T>,
  opts: Options = {},
): { inView: boolean; hasBeenInView: boolean } {
  const [inView, setInView] = useState(false);
  const [hasBeenInView, setHasBeenInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      // SSR ou très vieux navigateurs : on charge immédiatement
      setHasBeenInView(true);
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isIn = entry?.isIntersecting ?? false;
        setInView(isIn);
        if (isIn) setHasBeenInView(true);
        if (isIn && opts.once !== false) observer.disconnect();
      },
      { rootMargin: opts.rootMargin ?? '200px 0px', threshold: opts.threshold ?? 0.01 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, opts.rootMargin, opts.threshold, opts.once]);

  return { inView, hasBeenInView };
}
```

### `useNetworkInfo`

```ts
'use client';
import { useEffect, useState } from 'react';

interface NetworkInfo {
  saveData: boolean;
  effectiveType: '2g' | '3g' | '4g' | undefined;
  downlink: number | undefined;
}

export function useNetworkInfo(): NetworkInfo {
  const [info, setInfo] = useState<NetworkInfo>({
    saveData: false,
    effectiveType: undefined,
    downlink: undefined,
  });

  useEffect(() => {
    const conn = (navigator as any).connection;
    if (!conn) return;

    const update = () => setInfo({
      saveData: conn.saveData ?? false,
      effectiveType: conn.effectiveType,
      downlink: conn.downlink,
    });
    update();
    conn.addEventListener?.('change', update);
    return () => conn.removeEventListener?.('change', update);
  }, []);

  return info;
}
```

### `useReducedMotion`

```ts
'use client';
import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);
  return reduced;
}
```

## Précautions

### Empêcher le double-fetch

`viewport` et `idle` peuvent se déclencher simultanément si une image
est dans le viewport ET le navigateur idle. On garantit le mount unique
en stockant un flag `hasLoaded` :

```tsx
const [hasLoaded, setHasLoaded] = useState(false);
const shouldLoad = (inView || isIdle) && !hasLoaded;
```

### Empêcher le chargement zombie

Si un composant est démonté pendant le chargement, l'`<img>` peut
encore être en train de fetcher. On annule via `AbortController` côté
fetch RSC, mais côté HTML l'image continue. **Acceptable** : c'est
quelques KB perdus si l'utilisateur scroll très vite.

### Mode hors-ligne (PWA Phase 2)

Si on intègre service worker plus tard, le SW peut intercepter les
requêtes de variantes et servir le SVG fallback en cas de cache miss
+ network failure. Pas en Phase 1.

## Décision matrix

| Scénario | Stratégie recommandée |
|---|---|
| Hero principal de page | `eager` + `is_hero=true` |
| Image au-dessus du pli, non hero | `viewport` (rootMargin 0) |
| Image inline article (sous le pli) | `viewport` (rootMargin 200px) |
| Galerie de 50 thumbnails | `viewport` pour les 12 premières, `idle` pour le reste |
| Vidéo de fond muette | `eager` (avec autoplay muted) |
| Vidéo cliquable | `interaction` |
| Audio podcast | `interaction` (toujours) |
| Footer décoratif | `idle` |
| Sidebar décorative | `idle` |
| Image conditionnelle (modal pas encore ouverte) | `interaction` |
