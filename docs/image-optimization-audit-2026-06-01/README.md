# Audit & plan d'action — optimisation des images (2026-06-01)

## 0. Contexte / symptôme rapporté

> « Le site était configuré pour générer automatiquement des versions de taille
> et de format différentes et optimiser le chargement. Or je remarque, quand je
> charge la landing page, que les images sont chargées en **jpeg**. »

Objectif : auditer la filière d'optimisation d'images, comprendre pourquoi le
jpeg semble servi, corriger, et **verrouiller** le comportement avec une
batterie de tests (Vitest + RTL + Playwright).

---

## 1. Comment fonctionne la filière (rappel architecture)

```
DB media.variants (jpeg + webp + avif, plusieurs largeurs)
        │  getMedia(idOrSlug)
        ▼
resolve/config.ts : pickVariants(variants, config)
        │  → byFormat[avif|webp|jpeg] + bestFormat + buildSrcset()
        ▼
MediaImage.tsx (RSC)  →  MediaImageClient.tsx (client)
        ▼
<picture>
  <source type="image/avif" srcset="…/avif/*.avif … w">
  <source type="image/webp" srcset="…/webp/*.webp … w">
  <img class="media-img" src="…/jpeg/2xl.jpeg" srcset="…/jpeg/* … w">  ← FALLBACK
</picture>
```

Points clés :
- Le `<img>` porte **toujours** une URL **jpeg** dans `src`/`srcset` : c'est le
  **fallback** légitime du `<picture>`, pour les navigateurs sans avif/webp.
- Un navigateur moderne (tout Chromium/Safari/Firefox récents) choisit le
  **premier `<source>` qu'il supporte** → `avif`, sinon `webp`. Le jpeg n'est
  alors **jamais téléchargé**.
- `next.config.mjs` : `images.formats = ['image/avif','image/webp']`,
  `deviceSizes`/`imageSizes` complets → la génération multi-tailles est active.

---

## 2. Diagnostic du symptôme « jpeg »

Vérifié **dans un vrai navigateur** (Chromium via Playwright) contre le build de
prod local (`:3100`, DB seedée). Sur `/`, `/rituel`, `/journal`, `/kit`,
`/maison` :

| Constat | Résultat |
|---|---|
| `currentSrc` des `<picture> > img.media-img` | **`.avif`** partout |
| `<source>` exposés par chaque `<picture>` | `image/avif` + `image/webp` |
| Réponses réseau `content-type` du pipeline `/_media` | **`image/avif`** (ex. hero `2xl` : avif **80 ko** vs jpeg **181 ko**, −56 %) |
| Réponses jpeg du pipeline | **0** |

**Conclusion : l'optimisation fonctionne.** Le « jpeg » observé venait de :

1. **Lecture du DOM** : l'attribut `src` de l'`<img>` *est* une URL jpeg (le
   fallback). Inspecter `<img src>` montre du jpeg même quand le navigateur a
   peint l'avif (`currentSrc`). Il faut regarder `currentSrc`, pas `src`.
2. **Images `loading="lazy"` sous la ligne de flottaison** : tant qu'elles ne
   sont pas entrées dans le viewport, `currentSrc === ""` et un outil qui lit
   `img.currentSrc || img.src` retombe sur le jpeg fallback → **faux positif**.
3. **Cache navigateur** : un ancien jpeg en cache disque pouvait masquer la
   bascule avif après changement de pipeline (déjà observé sur le sélecteur de
   langue dans cette même session).

---

## 3. Vraie lacune trouvée (et corrigée)

`src/lib/media/preload.ts` exporte `buildHeroPreload()` (préchargement LCP du
hero dans le meilleur format) — mais **il n'était câblé nulle part** (`grep` =
0 usage). Conséquence : l'image hero (LCP de la landing) n'était **pas
préchargée**, ce qui retarde le Largest Contentful Paint.

### Correctif
`src/components/sections/HeroBound.tsx` (RSC) émet désormais, quand le hero a un
binding média actif et est `priority` :

```tsx
<link
  rel="preload" as="image"
  href={heroPreload.href}
  imageSrcSet={heroPreload.imageSrcset}
  imageSizes={heroPreload.imageSizes}
  type={heroPreload.type}          // image/avif
  fetchPriority="high"
/>
```

React 18.3 / Next 14 hoiste ce `<link>` dans `<head>`. Il réutilise **la même**
résolution (`pickVariants` + `bestFormat`) que le rendu → preload jamais
gaspillé (aucun mismatch de format/URL avec ce que l'`<img>` chargera).

---

## 4. Plan d'action exécuté — étapes & tests

### Étape 1 — Câbler le preload LCP du hero
- **Code** : `HeroBound.tsx` importe `buildHeroPreload`, calcule `heroPreload`
  (si `priority && resolved.media`) et rend le `<link rel=preload>`.
- **Test** : `src/lib/media/preload.test.ts` (Vitest, `getMedia` mocké via la
  fixture `makeImageMedia`) →
  - `type === 'image/avif'`, `as === 'image'`, `rel === 'preload'` ;
  - `imageSrcset` contient `.avif` + descripteurs `\d+w` ;
  - `null` si média introuvable ou non-image.

### Étape 2 — Verrouiller la négociation de format `<picture>`
- **Test** : `src/lib/media/components/MediaImageClient.test.tsx` (RTL) →
  - `<source>` rendus = exactement `['image/avif','image/webp']` (avif **avant**
    webp, **aucun** `<source>` jpeg) ;
  - chaque `<source>` porte le bon `srcset` (`.avif` / `.webp`) ;
  - le `<img class="media-img">` fallback pointe bien sur `.jpg`.
- Complète l'assertion déjà présente `bestFormat === 'avif'` dans
  `resolve/config.test.ts`.

### Étape 3 — Preuve de bout en bout (vrai navigateur)
- **Test** : `e2e/public-images.spec.ts` → nouveau test
  `« / : formats modernes servis (avif/webp, jamais jpeg) + preload hero LCP »` :
  1. `currentSrc` de chaque `<picture> > img` ∈ `{.avif, .webp}` ;
  2. `<picture>` expose `image/avif` + `image/webp` ;
  3. **0** réponse réseau jpeg sur `/_media`, et **≥ 1** réponse `image/avif` ;
  4. `<link rel=preload as=image type=image/avif>` présent dans `<head>`.
- **Robustesse lazy** : le helper `expectAllImagesVisible` parcourt désormais la
  page (scroll) pour déclencher les images `loading="lazy"` avant d'asserter
  `complete`, puis `waitForFunction` jusqu'à ce que toutes soient complètes —
  supprime le faux négatif décrit en §2.2.

### Étape 4 — MSW : périmètre honnête
La filière **publique** d'images est **résolue côté serveur depuis la DB**
(`getMedia` → Prisma), sans fetch HTTP côté client → **MSW ne s'applique pas**
ici (rien à intercepter au niveau réseau client). Les handlers MSW existants
(`src/test/msw/`) couvrant l'**admin média** restent en place et verts. Le
réseau de la filière publique est validé via la capture Playwright (§Étape 3),
plus pertinente qu'un mock.

---

## 5. Validation

| Suite | Commande | Résultat |
|---|---|---|
| Vitest (media) | `vitest run src/lib/media/{preload,resolve/config}.test.ts src/lib/media/components/MediaImageClient.test.tsx` | voir `TESTS.md` |
| Typecheck | `pnpm tsc --noEmit` | `0` erreur |
| Playwright | `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 pnpm playwright test e2e/public-images.spec.ts --project=chromium` | voir `TESTS.md` |

Détail des sorties : `TESTS.md`.

---

## 6. Fichiers touchés

- `apps/web/src/components/sections/HeroBound.tsx` — câblage du preload LCP.
- `apps/web/src/lib/media/preload.test.ts` — **nouveau** (Vitest).
- `apps/web/src/lib/media/components/MediaImageClient.test.tsx` — assertion
  négociation de format.
- `apps/web/e2e/public-images.spec.ts` — test format/preload + helper lazy-aware.
- `docs/image-optimization-audit-2026-06-01/` — ce dossier.
