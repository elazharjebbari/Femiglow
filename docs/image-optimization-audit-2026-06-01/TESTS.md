# Résultats de la batterie de tests — optimisation images (2026-06-01)

## Vitest — suite media (unitaire + RTL)

```
$ pnpm vitest run \
    src/lib/media/preload.test.ts \
    src/lib/media/components/MediaImageClient.test.tsx \
    src/lib/media/resolve/config.test.ts

 ✓ src/lib/media/resolve/config.test.ts        (6 tests)
 ✓ src/lib/media/preload.test.ts               (3 tests)   ← nouveau
 ✓ src/lib/media/components/MediaImageClient.test.tsx (14 tests)  ← +1

 Test Files  3 passed (3)
      Tests  23 passed (23)
```

Détail des nouveaux cas :
- `buildHeroPreload` → préchargement avif (`type:'image/avif'`, `as:'image'`,
  `imageSrcset` avec `.avif` + descripteurs `\d+w`) ; `null` si média absent /
  non-image.
- `MediaImageClient` → `<source>` rendus = `['image/avif','image/webp']` (avif
  d'abord, pas de `<source>` jpeg) ; `<img>` fallback en `.jpg`.

## Typecheck

```
$ pnpm tsc --noEmit
TSC_EXIT=0   (0 erreur)
```

## Playwright — e2e/public-images.spec.ts (chromium, build prod :3100 rebuildé)

```
$ PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 \
    pnpm playwright test e2e/public-images.spec.ts --project=chromium

  ✓ / : formats modernes servis (avif/webp, jamais jpeg) + preload hero LCP
  ✓ page / : images seedées visibles (pas floutées)
  ✓ page /rituel : images seedées visibles (pas floutées)
  ✓ page /journal : images seedées visibles (pas floutées)
  ✓ page /kit : images seedées visibles (pas floutées)
  ✓ page /maison : images seedées visibles (pas floutées)
  ✓ article journal : cover et inline rendent correctement

  8 passed (setup inclus)
```

Vérifié au préalable côté SSR (le preload est bien hoisté dans `<head>`) :
```
$ curl -s :3100/fr | grep 'rel="preload" … as="image"'
<link rel="preload" as="image" href="/_media/media/…/avif/2xl.avif"
  imageSrcSet="…/avif/sm.avif 480w, … 2xl.avif 1448w"
  imageSizes="(min-width: 1024px) 45vw, 100vw" type="image/avif" fetchPriority="high"/>
```

### Régression globale (sanity)
```
$ pnpm vitest run src/lib/media src/components/sections
 Test Files  67 passed (67)
      Tests  341 passed (341)
```

### Note méthodo — itération sur le helper
Première exécution : 3 échecs (`/rituel`, `/journal`, `/kit`) sur
`not complete: …/jpeg/2xl.jpeg`. Diagnostic (probe Playwright avec scroll) :
images `loading="lazy"` **sous la ligne de flottaison**, `complete=false` +
`currentSrc=""` → `img.currentSrc || img.src` retombait sur le fallback jpeg.
**Toutes** ces images servent en réalité de l'avif une fois dans le viewport.
Correctif du helper `expectAllImagesVisible` : scroll de la page pour déclencher
le lazy-load, puis `waitForFunction` jusqu'à `complete` pour toutes. Faux
négatif supprimé.

## MSW
Non applicable à la filière **publique** (résolution serveur depuis la DB, pas
de fetch HTTP client). Handlers MSW admin-média existants inchangés et verts.
La validation réseau publique passe par la capture Playwright ci-dessus.
