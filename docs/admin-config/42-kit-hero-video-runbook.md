# 42 — Kit Hero Image + Vidéo YouTube (CHA-243)

**Date :** 2026-05-12 · **Owner :** El Azhar Jebbari · **Statut :** Implémenté, attente seed prod

## Contexte

Deux évolutions du `/kit` :

1. **Image hero produit** doit pointer sur `docs/images/values/kit/image-produit.png`
   (et non plus `kit-principale.png`). L’image source ne doit PAS être adaptée :
   c’est le composant qui s’adapte à l’image (ratio 4:5 via Next/Image
   `object-cover`).
2. **Vidéo hero** doit accepter une URL YouTube (incluant les Shorts) et
   l’afficher via iframe privacy-friendly, sans permettre de fuir vers
   `youtube.com`. URL par défaut :
   `https://youtube.com/shorts/N2pDuciP4uQ?si=h9_ROBIt-N7Oq7jb`.

## Architecture

### Image hero — pipeline Components-CMS

```
docs/images/values/kit/image-produit.png
  └── (seed-from-docs CLI / Seeders Runner)
      └── Media row (`optimizeImage` + storage adapter)
          └── componentMediaBinding(kit-hero-produit, primary, isActive=true)
              └── <HeroProduitBound componentKey="kit-hero-produit">
                  └── <ComponentMedia>  (resolveComponentSlot lookup DB)
```

Si aucun binding actif n’est résolu : fallback automatique sur
`product.images[0]` du mock. Pas de risque de page cassée si le seed n’a
pas tourné.

### Vidéo YouTube — dispatcher

```
mock/kit.ts:videoSrc.youtubeUrl
  ├── défini ET parsable
  │   └── <YouTubeVariant>  →  <YouTubeEmbed>
  │       └── <iframe src="https://www.youtube-nocookie.com/embed/<id>?…">
  └── absent OU invalide
      └── <SelfHostedVariant>  →  <video>{sources.mp4/webm}</video>
```

`parseYouTubeUrl` accepte : `watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`,
ID brut 11 chars, sous-domaines `m.`, `music.`, `youtube-nocookie`. Si
l’URL n’est pas YouTube → null → fallback self-hosted (résilient).

### Privacy embed

L’iframe pointe **toujours** sur `youtube-nocookie.com` (domaine
privacy-enhanced de Google : pas de cookies déposés tant que l’utilisateur
n’a pas joué la vidéo). Params restrictifs :

| Param              | Valeur | Effet                                            |
|--------------------|--------|--------------------------------------------------|
| `rel`              | `0`    | Pas de vidéos suggérées en fin de lecture        |
| `modestbranding`   | `1`    | Minimise le logo YouTube                         |
| `iv_load_policy`   | `3`    | Pas d’annotations                                |
| `playsinline`      | `1`    | Lecture inline iOS (pas plein écran forcé)       |
| `controls`         | `1`    | Barre de contrôles standard                      |
| `fs`               | `1`    | Autorise le passage plein écran                  |
| `hl`               | `fr`   | Locale UI YouTube                                |

L’iframe a aussi :
- `referrerpolicy="strict-origin-when-cross-origin"` : pas de fuite du
  chemin d’origine vers Google
- `loading="lazy"` : aucune requête YouTube tant que l’iframe n’est pas
  dans le viewport (perf + RGPD)
- `allow="accelerometer; autoplay; clipboard-write; encrypted-media;
  fullscreen; gyroscope; picture-in-picture; web-share"` + attribut
  legacy `allowfullscreen` : les deux sont nécessaires pour couvrir
  Chrome/Firefox modernes (Permissions Policy `allow="fullscreen"`)
  ET Safari < 16.5 (attribut HTML legacy). `autoplay` autorise un play
  programmatique futur via IFrame API si on l’active. `picture-in-picture`
  permet le mode PiP système (Safari iOS notamment).

**Limite connue :** YouTube ne permet pas de masquer 100 % le lien
« Watch on YouTube » qui apparaît dans le coin du player. C’est imposé
par Google et c’est le standard de l’industrie. Les options ci-dessus
minimisent la fuite d’attention au maximum techniquement possible.

## Fichiers modifiés / créés

```
apps/web/src/lib/components/seed-mapping.ts          ← image-produit → kit-hero-produit
apps/web/src/lib/components/seed-mapping.test.ts     ← +3 tests régression
apps/web/src/lib/seeders/items/components.ts         ← autoActivate=true
apps/web/src/lib/schemas/page-content.ts             ← kitVideoSchema.youtubeUrl?
apps/web/src/lib/video/youtube-url.ts                ← NEW parser + builder
apps/web/src/lib/video/youtube-url.test.ts           ← NEW 31 tests
apps/web/src/components/sections/YouTubeEmbed.tsx    ← NEW client component
apps/web/src/components/sections/YouTubeEmbed.test.tsx ← NEW 13 tests
apps/web/src/components/sections/VideoPlayer4Gestes.tsx ← dispatcher
apps/web/src/components/sections/VideoPlayer4Gestes.test.tsx ← +4 tests
apps/web/src/data/mock/kit.ts                        ← videoSrc.youtubeUrl
apps/web/e2e/kit-video.spec.ts                       ← NEW E2E Playwright
```

## Procédure de déploiement

### 1. CI / pré-merge

Les tests unitaires couvrent les contrats critiques :

```bash
cd apps/web
pnpm exec vitest run --no-coverage \
  src/lib/video/youtube-url.test.ts \
  src/components/sections/YouTubeEmbed.test.tsx \
  src/components/sections/VideoPlayer4Gestes.test.tsx \
  src/lib/components/seed-mapping.test.ts
```

Attendu : `59 tests · 4 files · 0 failed`.

Typecheck :
```bash
cd apps/web && pnpm exec tsc --noEmit
```

E2E (nécessite dev server up + DB seedée) :
```bash
cd apps/web && pnpm exec playwright test e2e/kit-video.spec.ts
```

### 2. Seed image hero (post-deploy)

Une fois le code mergé sur main et déployé :

**Option A — UI Seeders Runner** (recommandé pour ops) :
1. Login admin → `/admin/settings/seeders`
2. Lancer le seeder « components »
3. Vérifier dans la sortie : `mediasSeeded ≥ 1`, `mediasActivated ≥ 1`,
   `fieldsBound ≥ N`. La summary doit mentionner
   `(N activés, M ignorés)`.

**Option B — CLI direct** (sans auto-activation, pour review) :
```bash
cd apps/web
pnpm tsx scripts/seed-components.ts
# Bindings créés isActive=false. Activer manuellement via /admin/components.
```

**Vérification post-seed :**
- DB : `components_media_bindings` doit contenir une ligne
  `(component_key=kit-hero-produit, slot=primary, is_active=true)`
- DB : `media` doit contenir une ligne avec `source_path` matchant
  `kit/image-produit.png`
- Page : `/kit` doit afficher la nouvelle image (vider le cache CDN si CDN)

### 3. Changer la vidéo YouTube

L’URL par défaut est dans `apps/web/src/data/mock/kit.ts:videoSrc.youtubeUrl`.

Pour changer la vidéo (admin/dev), remplacer la valeur par n’importe
quelle URL YouTube acceptée :

```ts
// Tous ces formats marchent :
youtubeUrl: 'https://youtube.com/shorts/N2pDuciP4uQ',
youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
youtubeUrl: 'N2pDuciP4uQ',  // ID brut 11 chars
youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
```

Si l’URL est invalide ou pointe ailleurs (vimeo, etc.) → le composant
retombe automatiquement sur le `<video>` self-hosted (sources mp4/webm).

## Rollback

### Rollback image hero
1. Re-mettre `kit/kit-principale.png` dans `IMAGE_TO_COMPONENT` ;
   retirer `kit/image-produit.png` (ou le placer dans
   `INTENTIONALLY_UNMAPPED`).
2. Re-run seeder. Le binding kit-hero-produit/primary pointera à nouveau
   sur kit-principale.

### Rollback vidéo YouTube
- Le plus rapide : supprimer la propriété `youtubeUrl` du `videoSrc`
  dans `mock/kit.ts`. Le dispatcher repassera sur le player self-hosted.
- Aucune action DB nécessaire (la vidéo n’est pas stockée en CMS).

## Observabilité

### Tracking
- L’embed YouTube émet `video_user_play` au clic sur le wrapper
  (proxy d’interaction). Provider = `youtube`.
- Pour un tracking plus précis (autoplay, % progression) : il faudrait
  charger `https://www.youtube.com/iframe_api` côté client + wrapper
  l’iframe dans `YT.Player`. Tradeoff : ~50 kB JS + cookies tiers
  (annule l’intérêt du domaine nocookie). Non implémenté ; à reconsidérer
  si besoin métier.

### Logs / erreurs
- Côté client : `console.warn('[YouTubeEmbed] URL invalide ou non
  reconnue: …')` en dev/test si l’URL ne parse pas. Pas de bruit en prod.
- Côté seed : sortie `runComponentsSeed` listée dans la summary UI.

## Tests passants à date (12/05/2026)

| Suite                                      | Tests | Status |
|--------------------------------------------|-------|--------|
| `lib/video/youtube-url.test.ts`            | 31    | ✓      |
| `lib/components/seed-mapping.test.ts`      | 8     | ✓      |
| `components/sections/YouTubeEmbed.test.tsx`| 13    | ✓      |
| `components/sections/VideoPlayer4Gestes.test.tsx`| 7 | ✓      |
| `lib/products/feed/*` (régression)         | 86    | ✓      |
| **Total ciblé**                            | **108** | ✓    |

E2E `kit-video.spec.ts` : 1 scénario (rendu iframe + ratio + privacy +
absence de leak vers youtube.com). À exécuter en CI E2E.

## Décisions architecturales

1. **`youtubeUrl` optionnel** plutôt qu’union discriminée → backward compat
   (les mocks existants n’ont pas besoin de changer).
2. **Fallback automatique** sur self-hosted si URL invalide → résilience
   contre une typo admin.
3. **`autoActivate=true` côté UI Seeders mais `false` côté CLI** →
   trade-off entre ergonomie ops et safety dev.
4. **Pas d’IFrame API YouTube** → privacy > tracking précis (peut être
   ré-évalué si besoin métier).
5. **`object-cover` + ratio 4:5** sur le hero → l’image source n’a pas
   besoin d’être pré-cropée, n’importe quel ratio fonctionne.

## Sécurité / Privacy

- ✅ Domaine `youtube-nocookie.com` (pas de cookies au load)
- ✅ `loading="lazy"` (pas de requête tant que pas dans le viewport)
- ✅ `referrerpolicy="strict-origin-when-cross-origin"` (pas de leak du
  path origin)
- ✅ E2E vérifie l’absence de requêtes vers `youtube.com` direct au load
- ⚠️ Lien « Watch on YouTube » dans le coin du player : imposé par
  Google, non bypassable côté embed

### CSP (Content-Security-Policy)

Pour que le navigateur autorise le framing de
`www.youtube-nocookie.com`, le middleware doit déclarer une directive
`frame-src` explicite. Sans elle, le fallback sur `default-src ‘self’`
bloque l’iframe (visible dans la console : `Framing
‘https://www.youtube-nocookie.com/’ violates the following Content
Security Policy directive: "default-src ‘self’"`).

Fichier : `apps/web/src/middleware.ts:buildCsp` →

```ts
"frame-src ‘self’ https://www.youtube-nocookie.com",
```

On autorise **uniquement** le sous-domaine `nocookie` ; `www.youtube.com`
direct n’est pas dans la liste pour ne pas réintroduire les cookies
tiers. Test de régression : `apps/web/e2e/csp-headers.spec.ts > frame-src
autorise www.youtube-nocookie.com (CHA-243)`.
