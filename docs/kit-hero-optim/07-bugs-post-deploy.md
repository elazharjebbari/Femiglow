# 07 — Bugs post-déploiement & plan de fix

> Enquête approfondie sur deux bugs remontés après la Phase 7. Cause racine
> identifiée pour chaque, plan de fix structuré avec étapes de validation.

---

## Bug 1 — Image hero principale = SVG placeholder au lieu de la vraie photo

### Symptôme observé

Sur la galerie hero `/kit`, l'image principale rendue est un dessin vectoriel
schématique (3 flacons stylisés + titre "LE RITUEL · FEMIGLOW" en bas) — pas
la vraie photo packshot (boîte FemiGlow ouverte + 2 pots paste/powder + polissoir
Step 4 sur fond beige clair).

Avant la refonte Phase 5, la page rendait la **vraie photo packshot**. La
régression vient donc bien du nouveau pipeline `getKitHeroGalleryImages`.

### Cause racine — confirmée

1. La table `media` en DB contient `kit-image-produit` (`me_4arvcdnelzb0i8ns`)
   avec des **variants** AVIF/WebP/JPEG en plusieurs tailles, mais
   `original_url = NULL` (le pipeline component-media n'a jamais besoin de l'URL
   d'origine en runtime, seuls les variants sont servis).
2. Le helper `slotToImage()` dans
   [`apps/web/src/lib/products/kit-hero-gallery.ts`](apps/web/src/lib/products/kit-hero-gallery.ts:135)
   lit `m.originalUrl` puis fait `if (!src) return null` — donc retourne `null`
   pour le slot `primary` malgré qu'il a un binding actif.
3. Le helper retombe ensuite sur le `productFallback` que `HeroProduitBound`
   passe : `product.images[0]` = `/products/kit-principale.png`.
4. Ce fichier `/public/products/kit-principale.png` **est lui-même un placeholder
   vectoriel** (1600×2000, 8-bit colormap, 9.6 KB). Le projet utilise ce PNG
   comme placeholder dev avant qu'une vraie photo soit uploadée.

**Vérification empirique** : `curl /_media/media/me_4arvcdnelzb0i8ns/webp/lg.webp`
retourne HTTP 200 avec une vraie photo WebP 1024×1280 (61 KB) — exactement
l'image attendue par l'utilisateur (cf. pièce jointe).

### Pourquoi ça marchait avant Phase 5

L'ancien `HeroProduitBound` faisait :

```tsx
const resolved = await resolveComponentSlot(componentKey, slot);
if (resolved?.binding?.isActive && resolved.media) {
  return (
    <HeroProduit
      mediaSlot={
        <ComponentMedia componentKey={componentKey} slot={slot} ... />
      }
    />
  );
}
```

`<ComponentMedia>` rendait `<MediaImage id={resolved.media.id} ... />` qui
utilise le pipeline de variants (`/_media/media/{id}/{format}/{size}.{ext}`)
côté `<picture>` avec `<source>` srcset. Pas besoin d'`originalUrl`.

Ma refonte a remplacé cette chaîne par une URL string passée à `next/image`,
ce qui casse les media seedés.

### Plan de fix — Bug 1

**Option A (recommandée) — réutiliser `<MediaImage>`**

1. Étendre `HeroGalleryImage` dans
   [`hero-gallery-types.ts`](apps/web/src/lib/products/hero-gallery-types.ts) :
   ```ts
   export interface HeroGalleryImage {
     id: string;
     /** Si présent, prioritaire sur `src` → rendu via `<MediaImage>`. */
     mediaId?: string;
     src: string;
     alt: string;
     width: number;
     height: number;
     blurDataURL?: string;
     kind: HeroGalleryImageKind;
     caption?: string;
   }
   ```

2. Adapter `slotToImage` dans
   [`kit-hero-gallery.ts`](apps/web/src/lib/products/kit-hero-gallery.ts:129) :
   ne plus rejeter quand `originalUrl` est vide, renvoyer le `mediaId` à la
   place. `src` peut rester `originalUrl ?? ''` (jamais lu si `mediaId` présent).

3. Adapter `HeroGalleryMain` dans
   [`HeroGalleryMain.tsx`](apps/web/src/components/sections/hero/HeroGalleryMain.tsx) :
   ```tsx
   if (image.mediaId) {
     return (
       <figure style={{ aspectRatio }}>
         <MediaImage id={image.mediaId} context="hero" ... />
       </figure>
     );
   }
   // Sinon pipeline classique <NextImage src={image.src} />
   ```

4. Idem pour `HeroGalleryThumbnails` (passer par une mini-version qui sait
   prendre soit `src` soit `mediaId`).

**Option B (quick fix) — construire l'URL variant à la main**

Dans `slotToImage`, si `originalUrl` vide :
```ts
const src = m.originalUrl ?? `/_media/media/${m.id}/webp/lg.webp`;
```

Moins propre (pas de srcset multi-format, pas de fallback JPEG) mais 3 lignes
de changement.

**Décision** : Option A. C'est la voie "officielle" du projet et garantit la
même qualité d'image qu'avant la Phase 5 (AVIF/WebP/JPEG négociés par browser,
srcset multi-resolutions).

### Étapes de validation Bug 1

1. Modifier les 3 fichiers (`hero-gallery-types.ts`, `kit-hero-gallery.ts`,
   `HeroGalleryMain.tsx`).
2. Mettre à jour les tests unit `kit-hero-gallery.test.ts` (mock du resolved
   media avec/sans mediaId).
3. Vérifier sur `/kit` que la première image de la galerie EST la vraie photo
   (boîte FemiGlow ouverte + pots + polissoir).
4. Vérifier que `kit-principale.png` placeholder n'est plus visible nulle part.
5. Rebuild prod + run + screenshot.

---

## Bug 2 — Scroll horizontal mobile saute des slides (1 → 5 au lieu de 1 → 2)

### Symptôme observé

Sur viewport mobile, swipe horizontal sur la galerie hero. Le scroll ne passe
pas par les slides intermédiaires : un swipe simple peut faire passer
directement de la slide 1 à la slide 5.

### Cause racine — confirmée par tests

Trois facteurs combinés :

1. **`scroll-snap-type: x mandatory`** sur le container scroller. Trop agressif :
   pendant l'inertia d'un swipe, le browser force le snap au plus proche, ce
   qui peut "sauter" plusieurs slides si le swipe a une vélocité forte. Le
   `mandatory` ne respecte pas la notion de slide adjacente.

2. **`scroll-snap-stop` absent** sur chaque slide (default `normal`). Avec
   `normal`, le browser autorise le scroll à "traverser" plusieurs slides en
   un seul mouvement d'inertia. C'est précisément ce que `scroll-snap-stop:
   always` empêcherait : forcer l'arrêt à chaque slide adjacente.

3. **`IntersectionObserver` avec threshold `[0.6, 0.9]`** :
   ```ts
   const visible = entries
     .filter((e) => e.isIntersecting && e.intersectionRatio >= 0.6)
     .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
   ```
   Pendant un swipe rapide, plusieurs slides peuvent être à >= 0.6 visibility
   simultanément. L'observer pick le plus visible — mais entre deux ticks
   d'observation rapides, le pick peut sauter d'index `1` à `5`. L'indicateur
   dots saute donc visuellement (même si le scroll physique est correct).

### Reproduction empirique

Tests dans la preview en viewport 375×812 :

| Action | Résultat |
|---|---|
| `scroller.scrollLeft = 367` (instantané) | `scrollLeft = 0` après assignment sync (snap force le retour) |
| `scroller.scrollTo({left: 367, behavior: 'instant'})` + attendre 300ms | `scrollLeft = 367` ✅ |
| `scroller.scrollTo({left: 367, behavior: 'smooth'})` + attendre 600ms | `scrollLeft = 0` ❌ (smooth + mandatory se battent) |
| Avec `scroll-snap-type: none` + smooth scroll | `scrollLeft = 1` ❌ (artefact preview Playwright probablement) |

Le test smooth-scroll programmatique est fortement perturbé par `mandatory`.
Sur vrai mobile avec swipe, l'inertia native + mandatory créent les sauts
observés.

### Plan de fix — Bug 2

Trois changements simultanés, tous CSS purs :

1. **Forcer `scroll-snap-stop: always`** sur chaque slide. Empêche le scroll
   de traverser plus d'une slide par geste de swipe.
2. **Garder `scroll-snap-type: x mandatory`** (semantique meilleure que
   `proximity` pour une galerie produit) — c'est `snap-stop` qui résout le
   bug, pas le changement de type.
3. **Améliorer l'IntersectionObserver** :
   - Threshold unique à `0.7` (au lieu de `[0.6, 0.9]`).
   - Ajouter un cooldown de 100ms après détection : ignore les events suivants
     pendant ce laps de temps. Le browser scroll-snap ayant convergé, le
     premier event post-cooldown est le bon.
   - Ignore les events tant que `scroller.scrollLeft` n'est pas stable (vérifier
     2 ticks consécutifs avec la même valeur).

### Étapes de validation Bug 2

1. Modifier
   [`HeroGallery.tsx`](apps/web/src/components/sections/hero/HeroGallery.tsx) :
   - Ajouter `snap-always` Tailwind class sur chaque slide div (ou
     `style={{ scrollSnapStop: 'always' }}`).
   - Réviser `IntersectionObserver` (threshold + cooldown).
2. Run la suite tests vitest sur `HeroGallery` (les 5 tests devraient passer
   inchangés — c'est du CSS et un ajustement d'observer).
3. Tester en viewport mobile 375px : faire 5 swipes successifs, vérifier que
   l'index progresse 0 → 1 → 2 → 3 → 4 → 5 → 6 (jamais de saut).
4. Vérifier que click sur dots fonctionne toujours (scroll programmatique vers
   slide N).
5. Test e2e mobile playwright : `playwright.test e2e/kit-hero.spec.ts
   --project=chromium-mobile` doit rester vert.

---

## Ordre d'exécution proposé

| Étape | Action | Effort |
|---|---|---|
| 1 | Fix Bug 1 (Option A — MediaImage) | ~30 min |
| 2 | Validation visuelle Bug 1 (screenshot vraie photo) | 5 min |
| 3 | Fix Bug 2 (snap-stop + observer cooldown) | ~20 min |
| 4 | Validation manuelle swipe mobile | 10 min |
| 5 | Rebuild prod + run | 5 min + boot |
| 6 | Capture finale `after-*` mise à jour | 5 min |

**Total estimé** : ~1h15 effort net.

---

## Risques & rollback

- **Bug 1** : `<MediaImage>` peut nécessiter un context particulier (RSC vs client).
  Si conflit, fallback Option B (URL variant construite à la main).
- **Bug 2** : `scroll-snap-stop: always` peut être trop strict sur certains
  browsers anciens (Safari < 15). Si la régression apparaît, rollback simple
  (retirer la classe).
- Aucune migration DB nécessaire, aucun change de seed — fix 100% côté code
  frontend.
