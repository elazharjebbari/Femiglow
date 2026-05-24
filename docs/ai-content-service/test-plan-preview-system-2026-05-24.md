# Plan de test — Système de preview Content Studio v2

| Champ | Valeur |
|---|---|
| **Version** | 1.0 |
| **Date** | 2026-05-24 |
| **Module** | Preview (PlatformPreview, PreviewPane, CalendarCard, LibraryGrid) |
| **Bugs confirmés** | 7 (3 critiques, 4 élevés) |

---

## 1. Bugs à corriger

### P-1 : Story/Reel containers taille 0 (CRITIQUE)

**Cause** : `maxWidth: 320` sans `width` explicite dans un contexte grid → le container collapse à 0×0.

**Correction** : Dans `PlatformPreview.tsx`, ajouter `width: '100%'` sur les containers Story (L109) et Reel (L139).

```tsx
// Avant
style={{ maxWidth: 320, aspectRatio: '9 / 16', ... }}
// Après  
style={{ width: '100%', maxWidth: 320, aspectRatio: '9 / 16', ... }}
```

### P-2 : Facebook ignore le format (CRITIQUE)

**Cause** : `if (platform === 'facebook') return <FacebookPreview>` — le format n'est jamais transmis.

**Correction** : Créer `FacebookStory`, `FacebookReel` sub-components ou passer `format` à `FacebookPreview` pour adapter l'aspect ratio et le chrome visuel :
- Facebook Post : 1.91:1 (landscape) — correct actuellement
- Facebook Story : 9:16 avec overlay gradient
- Facebook Reel : 9:16 avec chrome vidéo
- Facebook Carousel : 1:1 avec dots

### P-3 : Carousel `carouselSiblings` jamais passé (CRITIQUE)

**Cause** : `PreviewPane.tsx` L81 ne passe pas `carouselSiblings` à `PlatformPreview`.

**Correction** : Dans `CreateWorkspace`, collecter les media items liés au brief, les passer via PreviewPane → PlatformPreview. En attendant, au minimum afficher le badge `1/1` et des dots placeholder.

### P-4 : Caption vide → ellipsis seul (ÉLEVÉ)

**Cause** : `caption.split(' ').slice(0, 14).join(' ')` + `…` sans guard `caption`.

**Correction** :
```tsx
// Avant
{caption.split(' ').slice(0, 14).join(' ')}…
// Après
{caption ? <>{caption.split(' ').slice(0, 14).join(' ')}…</> : null}
```

### P-5 : Facebook captions longues overflow (ÉLEVÉ)

**Cause** : `{caption}` rendu sans troncation dans `FacebookPreview`.

**Correction** : Limiter à ~300 chars + "Voir plus" :
```tsx
const MAX = 300;
const truncated = caption.length > MAX;
<p>{truncated ? caption.slice(0, MAX) : caption}{truncated ? <span style={{...}}>… Voir plus</span> : null}</p>
```

### P-6 : CalendarCard image cassée pour vidéos (ÉLEVÉ)

**Cause** : Utilise `media.previewUrl` (mp4) comme `<img src>` sans vérifier `kind`.

**Correction** : Utiliser `media.thumbnailUrl ?? media.previewUrl` et afficher un overlay play si `kind === 'video'`.

### P-7 : LibraryGrid aspect ratio forcé 4:5 (ÉLEVÉ)

**Cause** : Ratio hardcodé sans tenir compte de `item.format`.

**Correction** : Map `format → aspectRatio` : post/carousel → 4:5, story/reel → 9:16.

---

## 2. Matrice de test — 8 dimensions × 4 couches

### 2.1 Matrice Platform × Format × Media × Caption

| # | Platform | Format | Media | Caption | Attendu | Bug actuel |
|---|---|---|---|---|---|---|
| 1 | Instagram | Post | Image | Normal | 4:5, image, caption avec hashtags | ✅ OK |
| 2 | Instagram | Post | Video | Normal | 4:5, vidéo autoplay muette | ✅ OK |
| 3 | Instagram | Post | null | Normal | 4:5, gradient placeholder | ✅ OK |
| 4 | Instagram | Post | Image | Vide | 4:5, image, pas de texte caption | ✅ OK |
| 5 | Instagram | Post | Image | 2200 chars | 4:5, caption complète, scrollable | ✅ OK |
| 6 | Instagram | Story | Image | Normal | 9:16, full-bleed, overlay caption | ❌ P-1 (0×0) |
| 7 | Instagram | Story | Video | Normal | 9:16, vidéo full-bleed | ❌ P-1 (0×0) |
| 8 | Instagram | Story | null | Normal | 9:16, gradient | ❌ P-1 (0×0) |
| 9 | Instagram | Story | Image | Vide | 9:16, image, pas d'ellipsis | ❌ P-1 + P-4 |
| 10 | Instagram | Story | Image | 2200 chars | 9:16, tronqué 14 mots | ❌ P-1 (0×0) |
| 11 | Instagram | Reel | Image | Normal | 9:16, image (mismatch format) | ❌ P-1 (0×0) |
| 12 | Instagram | Reel | Video | Normal | 9:16, vidéo, actions sidebar | ❌ P-1 (0×0) |
| 13 | Instagram | Reel | null | Normal | 9:16, gradient | ❌ P-1 (0×0) |
| 14 | Instagram | Reel | Video | Vide | 9:16, vidéo, pas d'ellipsis | ❌ P-1 + P-4 |
| 15 | Instagram | Carousel | Image | Normal | 4:5, dots/counter, 1/N | ❌ P-3 (pas de dots) |
| 16 | Instagram | Carousel | 3 images | Normal | 4:5, swipe/dots, 1/3 | ❌ P-3 (unimpl) |
| 17 | Facebook | Post | Image | Normal | 1.91:1, image, caption | ✅ OK |
| 18 | Facebook | Post | Video | Normal | 1.91:1, vidéo | ✅ OK |
| 19 | Facebook | Post | null | Normal | Pas d'image, caption seule | ✅ OK |
| 20 | Facebook | Post | Image | Vide | 1.91:1, image, caption vide | ✅ OK |
| 21 | Facebook | Post | Image | 2200 chars | Overflow sans troncation | ❌ P-5 |
| 22 | Facebook | Story | Image | Normal | 9:16, full-bleed | ❌ P-2 (= feed post) |
| 23 | Facebook | Story | Video | Normal | 9:16, vidéo | ❌ P-2 (= feed post) |
| 24 | Facebook | Reel | Video | Normal | 9:16, vidéo reel | ❌ P-2 (= feed post) |
| 25 | Facebook | Carousel | 3 images | Normal | Carousel dots | ❌ P-2 + P-3 |

**25 combinaisons × 3 couches de test = ~75 tests minimum.**

### 2.2 Thumbnails (CalendarCard + LibraryGrid)

| # | Contexte | Media kind | Format | Attendu | Bug |
|---|---|---|---|---|---|
| 26 | CalendarCard | Image | Post | Thumbnail visible | ✅ OK |
| 27 | CalendarCard | Video | Post | Poster frame, pas mp4 cassé | ❌ P-6 |
| 28 | CalendarCard | null | Post | Pas d'image, texte seul | ✅ OK |
| 29 | CalendarCard | Image | Story | Thumbnail visible | ✅ OK |
| 30 | LibraryGrid | Image | Post | 4:5 thumbnail | ✅ OK |
| 31 | LibraryGrid | Image | Story | 9:16 thumbnail | ❌ P-7 (4:5 forcé) |
| 32 | LibraryGrid | Image | Reel | 9:16 thumbnail | ❌ P-7 (4:5 forcé) |
| 33 | LibraryGrid | Video | Post | Play overlay + poster | ✅ OK |
| 34 | LibraryGrid | null | Post | Fallback | ✅ OK |

---

## 3. Tests à créer — détail par couche

### 3.1 Couche 1 — Vitest unit

| Fichier | Tests | Priorité |
|---|---|---|
| `PlatformPreview.render-matrix.test.tsx` | 25 tests : chaque combo platform×format×media×caption vérifie le bon sub-component rendu, les bons styles, les bons aspect ratios | P0 |
| `PlatformPreview.caption.test.tsx` | 8 tests : caption vide (pas d'ellipsis), caption longue (troncation Story/Reel 14 mots, Facebook 300 chars), caption avec hashtags, caption avec caractères spéciaux | P0 |
| `PlatformPreview.video.test.tsx` | 6 tests : video autoplay/muted/loop, video poster, video null poster, video dans carousel | P1 |
| `PlatformPreview.carousel.test.tsx` | 6 tests : carouselCount=1 (badge absent), carouselCount=3 (badge 1/3), dots render, siblings rendering | P0 |
| `PlatformPreview.a11y.test.tsx` | 5 tests : alt text, aria-hidden sur gradient, video aria-label, decorative icons | P1 |
| `CalendarCard.thumbnail.test.tsx` | 4 tests : image thumb OK, video uses thumbnailUrl not previewUrl, null media, play overlay for video | P0 |
| `LibraryGrid.aspect-ratio.test.tsx` | 4 tests : post=4:5, story=9:16, reel=9:16, carousel=4:5 | P0 |

**Volume : ~58 tests Vitest RTL**

### 3.2 Couche 2 — Vitest integration

| Fichier | Tests | Priorité |
|---|---|---|
| `PreviewPane.integration.test.tsx` | 10 tests : switch platform → correct sub-component, switch format → correct aspect ratio, carouselSiblings propagation, media null → gradient, onFormatChange/onPlatformChange callbacks | P0 |

**Volume : ~10 tests Vitest**

### 3.3 Couche 4 — Playwright E2E

| Fichier | Tests | Priorité |
|---|---|---|
| `preview-instagram-post.spec.ts` | 5 tests : image visible en 4:5, video plays, null media → gradient, caption avec hashtags, long caption scrollable | P0 |
| `preview-instagram-story.spec.ts` | 5 tests : container visible (width > 0), image full-bleed, overlay gradient, caption tronquée, empty caption pas d'ellipsis | P0 |
| `preview-instagram-reel.spec.ts` | 5 tests : container visible (width > 0), video plays, action sidebar, caption tronquée, empty caption clean | P0 |
| `preview-instagram-carousel.spec.ts` | 3 tests : badge counter visible, dots visible, visuellement distinct du post | P1 |
| `preview-facebook.spec.ts` | 6 tests : post correct, story adapté au format, reel adapté, caption longue tronquée, no media = text-only, carousel | P0 |
| `preview-dark-mode.spec.ts` | 4 tests : toggle dark → post preview correct, story preview correct, gradient visible, text lisible | P1 |
| `preview-switch.spec.ts` | 6 tests : switch ig→fb → layout change, switch post→story → ratio change, switch post→reel → ratio change, switch back → restored, format change fires callback, platform change fires callback | P0 |
| `thumbnail-calendar.spec.ts` | 3 tests : image thumb visible, video thumb uses poster (pas mp4), null = no image | P1 |
| `thumbnail-library.spec.ts` | 4 tests : post=4:5, story=9:16, reel=9:16, video has play overlay | P1 |
| `preview-visual-regression.spec.ts` | 8 screenshots baseline : ig-post, ig-story, ig-reel, ig-carousel, fb-post, fb-story, fb-reel, dark-mode | P1 |

**Volume : ~49 tests Playwright E2E**

---

## 4. Plan d'action

### Phase P.0 — Corrections bugs (1.5 jours)

| # | Tâche | Fichier(s) | Impact |
|---|---|---|---|
| P.0.1 | Fix P-1 : `width: '100%'` sur Story/Reel containers | `PlatformPreview.tsx` | Story/Reel deviennent visibles |
| P.0.2 | Fix P-2 : Facebook format-aware (Story/Reel/Carousel sub-components) | `PlatformPreview.tsx` | Facebook adapte son rendu au format |
| P.0.3 | Fix P-3 : Carousel badge + dots (PropagèrcarouselSiblings) | `PreviewPane.tsx`, `PlatformPreview.tsx` | Carousel visuellement distinct |
| P.0.4 | Fix P-4 : Guard caption vide dans Story/Reel | `PlatformPreview.tsx` | Plus d'ellipsis orphelin |
| P.0.5 | Fix P-5 : Troncation caption Facebook 300 chars + "Voir plus" | `PlatformPreview.tsx` | Plus d'overflow |
| P.0.6 | Fix P-6 : CalendarCard utilise thumbnailUrl pour vidéos | `CalendarCard.tsx` | Plus d'image cassée |
| P.0.7 | Fix P-7 : LibraryGrid aspect ratio par format | `LibraryGrid.tsx` | Story/Reel en 9:16 |

### Phase P.1 — Tests Vitest RTL (1.5 jours)

| # | Tâche | Volume |
|---|---|---|
| P.1.1 | `PlatformPreview.render-matrix.test.tsx` — 25 combos | 25 |
| P.1.2 | `PlatformPreview.caption.test.tsx` | 8 |
| P.1.3 | `PlatformPreview.video.test.tsx` | 6 |
| P.1.4 | `PlatformPreview.carousel.test.tsx` | 6 |
| P.1.5 | `PlatformPreview.a11y.test.tsx` | 5 |
| P.1.6 | `CalendarCard.thumbnail.test.tsx` | 4 |
| P.1.7 | `LibraryGrid.aspect-ratio.test.tsx` | 4 |
| P.1.8 | `PreviewPane.integration.test.tsx` | 10 |
| **Total** | | **68** |

### Phase P.2 — Tests Playwright E2E (2 jours)

| # | Tâche | Volume |
|---|---|---|
| P.2.1 | `preview-instagram-post.spec.ts` | 5 |
| P.2.2 | `preview-instagram-story.spec.ts` | 5 |
| P.2.3 | `preview-instagram-reel.spec.ts` | 5 |
| P.2.4 | `preview-instagram-carousel.spec.ts` | 3 |
| P.2.5 | `preview-facebook.spec.ts` | 6 |
| P.2.6 | `preview-dark-mode.spec.ts` | 4 |
| P.2.7 | `preview-switch.spec.ts` | 6 |
| P.2.8 | `thumbnail-calendar.spec.ts` | 3 |
| P.2.9 | `thumbnail-library.spec.ts` | 4 |
| P.2.10 | `preview-visual-regression.spec.ts` | 8 |
| **Total** | | **49** |

### Phase P.3 — Validation (0.5 jour)

| # | Tâche |
|---|---|
| P.3.1 | Suite Vitest complète → 0 échec |
| P.3.2 | Suite Playwright complète → 0 échec |
| P.3.3 | Visual regression baselines commit |
| P.3.4 | Commit final |

---

## 5. Comptage prévisionnel

| Couche | Existant | Preview (nouveau) | Total |
|---|---|---|---|
| Vitest RTL | ~170 | +68 | ~238 |
| Playwright E2E | ~145 | +49 | ~194 |
| **Total** | **~700** | **+117** | **~817** |

---

## 6. Runbook

### Étape 1 — Prérequis

```bash
cd /var/www/femiglow-staging/apps/web

# Vérifier suite actuelle verte
npx vitest run src/components/admin/content-studio-v2 --reporter=verbose 2>&1 | tail -5
systemctl is-active femiglow-staging.service
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/ 2>&1 | tail -5
```

### Étape 2 — Phase P.0 : Corrections

```bash
# Appliquer les 7 fixes
# Après chaque fix, vérifier :
npx vitest run src/components/admin/content-studio-v2 2>&1 | tail -5
# Attendu : existants toujours verts

# Build + restart
npm run build && chown -R nodeapp:nodeapp .next && systemctl restart femiglow-staging.service
sleep 3

git commit -m "fix(content-studio-v2): 7 bugs preview — Story/Reel taille, Facebook format, carousel, captions, thumbnails"
```

### Étape 3 — Phase P.1 : Vitest RTL

```bash
# Créer les 8 fichiers de test
npx vitest run src/components/admin/content-studio-v2/media --reporter=verbose
npx vitest run src/components/admin/content-studio-v2/create/PreviewPane --reporter=verbose
npx vitest run src/components/admin/content-studio-v2/plan/CalendarCard --reporter=verbose
npx vitest run src/components/admin/content-studio-v2/library/LibraryGrid --reporter=verbose

git commit -m "test(content-studio-v2): preview Vitest RTL — 68 tests render matrix, caption, video, carousel, a11y, thumbnails"
```

### Étape 4 — Phase P.2 : Playwright E2E

```bash
npm run build && chown -R nodeapp:nodeapp .next && systemctl restart femiglow-staging.service
sleep 3

PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/preview --reporter=list
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/thumbnail --reporter=list

# Visual regression baselines
npx playwright test --update-snapshots e2e/content-studio-v2/preview-visual-regression.spec.ts
git add e2e/content-studio-v2/preview-visual-regression.spec.ts-snapshots/

git commit -m "test(content-studio-v2): preview E2E — 49 tests ig/fb × post/story/reel/carousel + dark + visual regression"
```

### Étape 5 — Validation finale

```bash
npx vitest run src/lib/content-studio src/lib/content-studio-v2 \
  src/components/admin/content-studio-v2 src/test/msw/content-studio 2>&1 | tail -5
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 npx playwright test e2e/content-studio-v2/ 2>&1 | tail -5
```
