# 03 — Système de vignettes hero (`HeroGallery`)

> Spec complète du système de galerie hero. Mobile-first, accessible, performant, élégant, robuste. La pièce centrale de la refonte.

---

## 1. Objectifs

1. **Augmenter la conversion** en exposant 4-7 images au lieu d'une seule (`Ecommerce` p. 20-22 : isolated → contextual + photos clientes = +60 % effet additif sur cible féminine).
2. **Optimiser l'UX mobile** : swipe naturel, dots indicator, zéro friction.
3. **Optimiser l'UX desktop** : thumbnails verticales à gauche, swap instantané, zoom au hover.
4. **Préserver la performance** : LCP < 2,5 s, première image en `priority`, autres en `lazy`.
5. **Accessibilité totale** : navigation clavier, screen readers, `prefers-reduced-motion`.
6. **Robustesse** : fonctionne avec 1 image (cas dégradé), avec 7 images (cas riche), sans JS (progressive enhancement).

---

## 2. Mobile (≤ 1023 px)

### 2.1 Layout

```
┌─────────────────────────────────────┐
│  ┌────────┬────────┬────────┐       │
│  │        │        │        │       │   ← container snap-scroll
│  │  IMG 1 │  IMG 2 │  IMG 3 │  ...  │     overflow-x auto
│  │        │        │        │       │     scroll-snap-type: x mandatory
│  │ 4:5    │ 4:5    │ 4:5    │       │
│  │        │        │        │       │
│  └────────┴────────┴────────┘       │
│                                     │
│     ● ○ ○ ○ ○ ○ ○                  │   ← dots (alignés sous le scroll)
└─────────────────────────────────────┘
```

**CSS clés** :

```css
.gallery {
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  overflow-x: auto;
  scroll-behavior: smooth;
}
.gallery > .slide {
  scroll-snap-align: center;
  flex: 0 0 100%;
}
.gallery::-webkit-scrollbar { display: none; }
.gallery { scrollbar-width: none; }
```

### 2.2 Comportement

- **Swipe horizontal natif** : utilise le scroll-snap CSS. Aucun JS pour le swipe (Performance + a11y maximum).
- **Snap au centre** : chaque image occupe 100 % de la largeur conteneur.
- **Dots synchronisés** : un `IntersectionObserver` détecte quelle image est centrée et met à jour l'index.
- **Click sur un dot** : `scrollTo` JS sur le slide correspondant (smooth).
- **Pas de boutons next/prev mobile** : le swipe est l'interaction native attendue.
- **Préchargement progressif** : image 1 `priority`, images 2-3 `loading="eager"`, suivantes `loading="lazy"`.

### 2.3 Gestures

- Swipe rapide à droite/gauche : passe à l'image suivante/précédente (natif).
- Pincement zoom : désactivé (`touch-action: pan-x` sur le container).
- Tap sur image : pas d'ouverture lightbox dans cette V1 (lightbox = chantier V2 hors périmètre).

### 2.4 Dots

```
●  Image active (8 × 8 px, sauge profond #4A5D4A)
○  Image inactive (8 × 8 px, gris-sauge #C7CCC2)
```

- Espacement : 12 px entre dots.
- Zone tap : 24 × 24 px (padding invisible).
- Animation : transition `background-color` 200 ms.
- `aria-label` : `"Voir l'image 3 sur 7"`.

### 2.5 Aspect ratio mobile

- Ratio **3:4** sur mobile (vs 4:5 desktop) — gain de hauteur écran d'environ 25 %.
- Width = 100 % du viewport.
- Height calculé = `viewport_width * 4 / 3 ≈ 500 px` sur 375 px width.

> Si la hauteur est encore trop importante, fallback à `min(500px, 60vh)`.

---

## 3. Desktop (≥ 1024 px)

### 3.1 Layout

```
┌────┬──────────────────────┬────────────────────────┐
│┌──┐│                      │  LE RITUEL             │
││📷││                      │  Pack FemiGlow         │
│└──┘│                      │  ★★★★⯨ 4,8/5 · 287 avis │
│┌──┐│                      │                        │
││📷││    IMAGE PRINCIPALE  │  Tagline...            │
│└──┘│      (ratio 4:5)     │                        │
│┌──┐│      animée 400 ms   │  [chips] [chips]       │
││📷││      au swap         │                        │
│└──┘│                      │  Description longue    │
│┌──┐│                      │                        │
││📷││                      │  199 MAD    ̶3̶9̶0̶ ̶M̶A̶D̶   │
│└──┘│                      │       Économie 191 MAD │
│┌──┐│                      │                        │
││📷││                      │  Livraison offerte ·   │
│└──┘│                      │  Paiement à la livr… · │
│ ▼ │                      │  Retour 30 jours       │
│    │                      │                        │
│ ←  │                      │  [Commander le rituel] │
│ →  │                      │                        │
└────┴──────────────────────┴────────────────────────┘
 ~80px        ~480px                  ~480px
```

### 3.2 Comportement

- **Thumbnails verticales à gauche** (5-7 visibles, scrollables verticalement si > 7).
- **Click sur thumbnail** : l'image principale fade out (opacity 0.5, 200 ms) puis fade in la nouvelle (opacity 1, scale 1.02 → 1, 400 ms).
- **Hover thumbnail** : aucune action (juste highlight border 1 px sauge profond).
- **Image active** : thumbnail entourée d'un border 2 px sauge profond.
- **Flèches ← →** : visibles uniquement au hover du container image principale, en bas, semi-transparentes (zone clic 40 × 40 px).
- **Navigation clavier** : flèches gauche/droite quand le focus est sur la galerie.

### 3.3 Animation de swap

```css
.gallery-main {
  transition: opacity 200ms ease-out, transform 400ms ease-out;
}
.gallery-main.swapping {
  opacity: 0.5;
}
.gallery-main.entered {
  opacity: 1;
  transform: scale(1);
  animation: zoomIn 400ms ease-out;
}
@keyframes zoomIn {
  from { transform: scale(1.02); }
  to { transform: scale(1); }
}
```

Avec `prefers-reduced-motion: reduce` :

```css
@media (prefers-reduced-motion: reduce) {
  .gallery-main { transition: none; animation: none; }
  .gallery-main.swapping { opacity: 1; }
}
```

### 3.4 Zoom hover (optionnel — V1.1)

- Au hover sur l'image principale : le curseur devient une loupe.
- Au click : ouverture d'un lightbox plein écran (réutilisation du pattern `RitualPhotoLightbox` avec Framer Motion).
- **Périmètre** : on n'implémente PAS le lightbox dans cette V1. On laisse un comment TODO V1.1 dans le code.

---

## 4. Spec du composant `HeroGallery`

### 4.1 Arborescence

```
HeroGallery (orchestrateur, gère state)
├── HeroGalleryThumbnails (desktop only — hidden lg:flex)
├── HeroGalleryMain
│   ├── (image active rendue avec Next/Image)
│   ├── HeroGalleryArrow direction="prev" (desktop only)
│   └── HeroGalleryArrow direction="next" (desktop only)
└── HeroGalleryDots (mobile only — lg:hidden)
```

### 4.2 Variantes de rendu

- **0 image** : ne rend rien (le parent doit gérer le fallback). Le composant `HeroProduit` garde un fallback vers `product.images[0]`.
- **1 image** : rend uniquement l'image, sans thumbnails, sans dots, sans flèches.
- **2-6 images** : rendu normal.
- **7+ images** : thumbnails scrollables verticalement, dots remplacés par "X / N" texte sur mobile au-delà de 6 dots.

### 4.3 Pseudo-code orchestrateur

```typescript
'use client';

export function HeroGallery({ images, initialIndex = 0, showThumbnails = true, onChange }: HeroGalleryProps) {
  const { currentIndex, setIndex, next, prev } = useGallery({ count: images.length, initialIndex });
  const reducedMotion = useReducedMotion();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  useEffect(() => {
    onChange?.(currentIndex, images[currentIndex]);
  }, [currentIndex, images, onChange]);

  if (images.length === 0) return null;
  if (images.length === 1) {
    return <HeroGalleryMain image={images[0]} reducedMotion={reducedMotion} priority />;
  }

  return (
    <div className="hero-gallery" role="region" aria-label="Galerie produit" aria-roledescription="carrousel">
      {isDesktop && showThumbnails && (
        <HeroGalleryThumbnails
          images={images}
          currentIndex={currentIndex}
          onSelect={setIndex}
        />
      )}
      <div className="hero-gallery__viewport">
        {isDesktop ? (
          <>
            <HeroGalleryMain
              image={images[currentIndex]}
              reducedMotion={reducedMotion}
              priority={currentIndex === 0}
            />
            <HeroGalleryArrow direction="prev" onClick={prev} disabled={images.length <= 1} />
            <HeroGalleryArrow direction="next" onClick={next} disabled={images.length <= 1} />
          </>
        ) : (
          <MobileSnapScrollGallery
            images={images}
            currentIndex={currentIndex}
            onIndexChange={setIndex}
          />
        )}
      </div>
      {!isDesktop && <HeroGalleryDots count={images.length} activeIndex={currentIndex} onSelect={setIndex} />}
    </div>
  );
}
```

### 4.4 Hook `useGallery`

```typescript
interface UseGalleryParams {
  count: number;
  initialIndex?: number;
}

export function useGallery({ count, initialIndex = 0 }: UseGalleryParams) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(Math.max(0, initialIndex), Math.max(0, count - 1))
  );

  const setIndex = useCallback((i: number) => {
    if (count === 0) return;
    setCurrentIndex(((i % count) + count) % count); // safe modulo
  }, [count]);

  const next = useCallback(() => setIndex(currentIndex + 1), [setIndex, currentIndex]);
  const prev = useCallback(() => setIndex(currentIndex - 1), [setIndex, currentIndex]);

  return { currentIndex, setIndex, next, prev };
}
```

**Cas particuliers gérés** :
- `count = 0` → `setIndex` ne fait rien.
- `initialIndex` hors borne → clamp.
- Wrap around (passer de N-1 à 0 et inversement).

### 4.5 Variant `MobileSnapScrollGallery` (mobile)

```typescript
function MobileSnapScrollGallery({ images, currentIndex, onIndexChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Quand currentIndex change (via dot click), scroll vers le slide
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const slide = container.children[currentIndex] as HTMLElement;
    if (!slide) return;
    slide.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentIndex]);

  // 2. Détection du slide actuellement centré (swipe utilisateur)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting && e.intersectionRatio >= 0.6);
        if (visible) {
          const idx = Array.from(container.children).indexOf(visible.target);
          if (idx !== -1 && idx !== currentIndex) onIndexChange(idx);
        }
      },
      { root: container, threshold: [0.6] }
    );
    Array.from(container.children).forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [currentIndex, onIndexChange, images.length]);

  return (
    <div ref={containerRef} className="hero-gallery__mobile-scroll" aria-live="polite">
      {images.map((img, i) => (
        <div key={img.id} className="hero-gallery__slide" data-index={i}>
          <HeroGalleryMain image={img} reducedMotion={false} priority={i === 0} />
        </div>
      ))}
    </div>
  );
}
```

---

## 5. Accessibilité — Détail

### 5.1 ARIA

- Container : `role="region"` + `aria-label="Galerie produit"` + `aria-roledescription="carrousel"`.
- Slides : `role="group"` + `aria-roledescription="diapositive"` + `aria-label="3 sur 7"`.
- Thumbnails : `role="button"` + `aria-current="true"` sur la thumbnail active + `aria-label="Voir l'image 3 sur 7"`.
- Dots : `role="button"` + `aria-current="true"` + `aria-label`.
- Boutons flèches : `aria-label="Image précédente"` / `"Image suivante"`.
- `aria-live="polite"` sur le container slide-scroll mobile pour annoncer les changements.

### 5.2 Navigation clavier

| Touche | Action |
|---|---|
| ← | Image précédente |
| → | Image suivante |
| Home | Première image |
| End | Dernière image |
| Tab | Sortie de la galerie vers l'élément suivant |
| Shift+Tab | Retour à l'élément précédent |
| Enter / Space sur thumbnail/dot | Active la sélection |

Implémentation via `onKeyDown` sur le `role="region"`.

### 5.3 Focus management

- Focus visible sur thumbnails et dots : outline 2 px sauge profond + offset 2 px.
- Focus reste sur l'élément cliqué après sélection.
- Pas de focus trap (la galerie n'est pas modale).

### 5.4 Reduced motion

`useReducedMotion` détecte `prefers-reduced-motion: reduce` :
- Désactive la transition de fade sur le swap.
- Désactive le `scroll-behavior: smooth` (passe à `auto`).
- Désactive le micro-pulse du CTA (sera utilisé par `HeroProduit` aussi).

### 5.5 Screen readers

- Annonce le nombre total d'images dans le label.
- Annonce le changement d'image via `aria-live="polite"`.
- Caption optionnelle pour les reviews : `"I. R. · Rabat"` lu par le SR.

---

## 6. Performance

### 6.1 Loading strategy

| Image | Mobile | Desktop |
|---|---|---|
| Index 0 (principale au load) | `priority + fetchPriority="high"` | `priority + fetchPriority="high"` |
| Index 1-2 | `loading="eager"` (préchargées) | `loading="eager"` |
| Index 3+ | `loading="lazy"` | `loading="lazy"` |

### 6.2 Tailles d'image

`<Image sizes="...">` :
- Mobile : `100vw`
- Desktop : `40vw` (≈ 480-512 px de large)

### 6.3 Pré-chargement au hover thumbnail (desktop)

Quand l'utilisateur hover une thumbnail, on déclenche un préchargement de l'image cible :

```typescript
function preloadImage(src: string) {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  document.head.appendChild(link);
}
```

Optionnel, à activer si Lighthouse signale un INP élevé.

### 6.4 Pas de re-render parent

L'index de la galerie est local au composant. Aucun callback parent par défaut sauf si `onChange` fourni (utilisé seulement pour analytics).

### 6.5 Bundle size

| Composant | Estimation gzippé |
|---|---|
| `HeroGallery` + sous-composants | ~3-4 KB |
| `useGallery` hook | <500 B |
| Total | ~4-5 KB ajoutés au bundle client |

**Pas de dépendance externe** (pas de Swiper.js, pas de Keen-slider). Tout est natif CSS scroll-snap + IntersectionObserver.

---

## 7. États visuels (specs)

### 7.1 Thumbnail desktop

| État | Visuel |
|---|---|
| Default | border 1 px gris-sauge `#C7CCC2`, opacity 1 |
| Hover | border 1 px sauge profond `#4A5D4A`, opacity 1 |
| Active | border 2 px sauge profond `#4A5D4A`, opacity 1, subtle inner glow |
| Focused | outline 2 px sauge profond + offset 2 px |
| Pressed | scale 0.97 (100 ms) |

### 7.2 Dot mobile

| État | Visuel |
|---|---|
| Default | 8 × 8 px, bg gris-sauge `#C7CCC2` |
| Active | 8 × 8 px, bg sauge profond `#4A5D4A` |
| Focused | outline 2 px sauge profond + offset 2 px |
| Pressed | scale 0.85 (100 ms) |

### 7.3 Image principale desktop

| État | Visuel |
|---|---|
| Default | opacity 1, scale 1 |
| Swapping (transition out) | opacity 0.5, 200 ms |
| Entered (transition in) | scale 1.02 → 1, opacity 1, 400 ms |
| Reduced motion | opacity 1 always, no transform |

---

## 8. Edge cases

| Cas | Comportement |
|---|---|
| `images = []` | Composant ne rend rien, parent affiche fallback |
| `images.length === 1` | Image seule, sans nav |
| Image manque `blurDataURL` | Skeleton background gris-sauge pâle |
| Image 404 (broken) | Fallback `Image.alt` affiché en text + placeholder gris |
| Trackpad horizontal scroll (Mac) | Marche nativement (scroll-snap CSS) |
| IE11 / browsers anciens | Pas de scroll-snap → comportement scroll standard, dots cliquables OK |
| Click ultra-rapide sur 2 thumbnails | Le 2e click annule le swap en cours (transition cancelable) |
| Image très haute (portrait extrême) | `object-fit: cover` + ratio fixé 4/5 → crop bottom élégant |
| Resize entre mobile et desktop | Composant re-rend avec le bon variant via `useMediaQuery` |
| RTL (arabe) | Hors périmètre V1 — TODO V2 |

---

## 9. Tests prévus (résumé — détail en `04-test-strategy.md`)

### 9.1 Unit (vitest + RTL)
- `useGallery` : navigation, wrap, clamp, count=0
- `HeroGalleryDots` : rendu N dots, click change index, aria-current
- `HeroGalleryThumbnails` : rendu N thumbs, active state, click change index
- `HeroGalleryArrow` : disabled state, click → callback
- `HeroGallery` : intégration sous-composants, variantes (0/1/N images), keyboard nav

### 9.2 E2E (playwright)
- Desktop : ouvre `/kit`, vérifie 4-7 thumbnails, click sur thumb 3 → image principale change.
- Mobile : ouvre `/kit` en viewport 375 × 812, swipe à droite via `page.touchscreen`, vérifie l'index dots.
- A11y : axe-core scan, 0 violation sérieuse.
- Keyboard : tab → focus thumbnail, → flèche droite → image change.

---

## 10. Réutilisabilité

Le système `HeroGallery` est conçu pour être **réutilisable hors du hero** :

- Page `/maison` : galerie produits secondaires (chantier futur).
- Page produit alternative (futurs SKUs).
- Section "Atelier" (déjà gérée par `AtelierGallery`, mais à terme migrer vers `HeroGallery` pour unifier).

L'interface `HeroGalleryProps` est volontairement générique (pas de couplage avec un produit spécifique). Le rebrand `Hero` dans le nom est historique — à terme, renommer en `MediaGallery` n'est pas exclu.

---

## 11. Voir aussi

- [`02-architecture.md`](02-architecture.md) — props et data flow
- [`04-test-strategy.md`](04-test-strategy.md) — tests détaillés
- Composant existant similaire : `apps/web/src/components/sections/AtelierGallery.tsx` (pattern dialog/lightbox)
- Composant existant similaire : `apps/web/src/components/commerce/HandsTestimonialCarousel.tsx` (pattern snap-scroll mobile)
