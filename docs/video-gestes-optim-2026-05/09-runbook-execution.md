# 09 — Runbook d'exécution

## 0. Pré-requis

### 0.1 Environnement

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20

cd /Users/elazhar/PycharmProjects/template-femiglow
pnpm install --frozen-lockfile
```

### 0.2 Variables d'environnement

`.env.local` :

```
NEXT_PUBLIC_VIDEO_V2=true                  # active la refonte (default true)
NEXT_PUBLIC_VIDEO_SOURCE=youtube           # 'youtube' tant que phase 7 non livrée
```

### 0.3 Branche

```bash
git checkout master
git pull --ff-only
git checkout -b video-gestes-optim-2026-05
```

Branches dédiées par phase (recommandé pour PR review) :

```bash
git checkout -b video/phase-0-quick-wins
# … travail …
git checkout video-gestes-optim-2026-05
git merge --no-ff video/phase-0-quick-wins
```

### 0.4 Baseline

```bash
cd apps/web
pnpm typecheck
pnpm vitest run
```

Noter le compte tests passants/échouants dans `video-phase-baseline.txt`.

---

## Phase 0 — Quick wins iframe

### 0.1 Branche

```bash
git checkout -b video/phase-0-quick-wins
```

### 0.2 Tests d'abord

Étendre `YouTubeEmbed.test.tsx` avec ~4 cas (cf. `07-tests-strategy.md` §4.1).

```bash
pnpm vitest run YouTubeEmbed
```

Tests rouges.

### 0.3 Implémenter

1. Étendre `buildYouTubeEmbedUrl` avec `mute`, `captions`, `enableJsApi`.
2. Étendre `YouTubeEmbed` props.
3. Modifier `VideoPlayer4Gestes.tsx` : H2 « Quatre gestes » + `bg-[#E8EDE3]`.

### 0.4 Valider

```bash
pnpm typecheck
pnpm vitest run YouTubeEmbed VideoPlayer4Gestes youtube-url
pnpm --filter web dev
# Ouvrir http://localhost:3001/kit, scroller à la vidéo
# Inspecter URL iframe — doit contenir mute=1, cc_load_policy=1, cc_lang_pref=fr
```

### 0.5 Commit

```bash
git commit -am "feat(video): phase 0 — quick wins iframe (mute/captions/titre/fond)"
```

---

## Phase 1 — Schema étendu

### 1.1 Branche

```bash
git checkout -b video/phase-1-schema
```

### 1.2 Tests d'abord

Étendre `page-content.test.ts` avec `videoChapterSchema` et nouveaux champs (~15 cas).

```bash
pnpm vitest run page-content
```

### 1.3 Implémenter

1. `rituelVideoSchema` étendu (cf. `03-data-model.md` §2).
2. Mock `videoSrc` enrichi.
3. `data/mock/kit.test.ts` étendu.

### 1.4 Valider

```bash
pnpm typecheck
pnpm vitest run page-content mock/kit feed.xml kit-feed
```

### 1.5 Commit

```bash
git commit -am "feat(video): phase 1 — schema RituelVideo étendu (chapters/provenance/etc.)"
```

---

## Phase 2 — `VideoPosterCover`

### 2.1 Branche

```bash
git checkout -b video/phase-2-poster-cover
```

### 2.2 Tests d'abord

`VideoPosterCover.test.tsx` avec ~10 cas.

```bash
pnpm vitest run VideoPosterCover
```

### 2.3 Implémenter

1. `VideoPosterCover.tsx`.
2. `YouTubeEmbed` étendu : props `autoplayOnMount`, `iframeRef`.
3. Brancher `VideoPlayer4Gestes.tsx`.

### 2.4 Valider

```bash
pnpm typecheck
pnpm vitest run VideoPosterCover YouTubeEmbed VideoPlayer4Gestes
pnpm --filter web dev
# Ouvrir /kit, vérifier que le poster maison est visible avant le clic.
# Cliquer → iframe monte avec autoplay + mute.
```

### 2.5 Commit

```bash
git commit -am "feat(video): phase 2 — VideoPosterCover click-to-play overlay"
```

---

## Phase 3 — `VideoChapters`

### 3.1 Branche

```bash
git checkout -b video/phase-3-chapters
```

### 3.2 Tests d'abord

- `lib/video/chapters.test.ts` (~8 cas).
- `VideoChapters.test.tsx` (~10 cas).

```bash
pnpm vitest run chapters
```

### 3.3 Implémenter

1. `lib/video/chapters.ts` (helpers purs).
2. `VideoChapters.tsx`.
3. Brancher `VideoPlayer4Gestes.tsx` (currentSeconds state).

### 3.4 Valider

```bash
pnpm typecheck
pnpm vitest run chapters VideoChapters VideoPlayer4Gestes
pnpm --filter web dev
# Ouvrir /kit, scroller à la vidéo.
# Vérifier 4 segments cliquables avec timestamps 0:00 / 0:18 / 0:42 / 1:08.
# Cliquer sur un chapitre → tracking `video_chapter_click` en Network.
```

### 3.5 Commit

```bash
git commit -am "feat(video): phase 3 — VideoChapters mini-timeline cliquable"
```

---

## Phase 4 — IFrame API tracker

### 4.1 Branche

```bash
git checkout -b video/phase-4-iframe-tracker
```

### 4.2 Tests d'abord

`iframe-tracker.test.ts` + `VideoIFrameTracker.test.tsx`.

```bash
pnpm vitest run iframe-tracker VideoIFrameTracker
```

### 4.3 Implémenter

1. `lib/video/iframe-tracker.ts` (loader + attach).
2. `VideoIFrameTracker.tsx` (composant qui orchestre).
3. Mock YouTube API : `apps/web/src/test/mocks/youtube-iframe-api.ts`.
4. Brancher dans `VideoPlayer4Gestes.tsx`.

### 4.4 Valider

```bash
pnpm typecheck
pnpm vitest run iframe-tracker VideoIFrameTracker VideoPlayer4Gestes
pnpm --filter web build && pnpm --filter web start
# Ouvrir /kit en prod, lancer la vidéo, attendre 25/50/75/100 %.
# Vérifier dans DevTools Network les requêtes POST /api/track avec
# event_name: video_progress_25, _50, _75, video_complete.
```

### 4.5 Commit

```bash
git commit -am "feat(video): phase 4 — IFrame API tracker (complete + 25/50/75)"
```

---

## Phase 5 — Provenance + CTA post

### 5.1 Branche

```bash
git checkout -b video/phase-5-provenance-cta
```

### 5.2 Tests d'abord

Étendre `VideoPlayer4Gestes.test.tsx` (~5 cas).

### 5.3 Implémenter

1. `VideoPostCta.tsx`.
2. Rendu conditionnel `provenance` dans `VideoPlayer4Gestes`.

### 5.4 Valider

```bash
pnpm typecheck
pnpm vitest run VideoPlayer4Gestes
pnpm --filter web dev
# Vérifier l'italique sous le sous-titre + CTA `Voir le pack ci-dessous ↓`.
# Click CTA → scroll vers #commander-femiglow.
```

### 5.5 Commit

```bash
git commit -am "feat(video): phase 5 — provenance maison + CTA post-vidéo"
```

---

## Phase 6 — Admin éditeur

### 6.1 Branche

```bash
git checkout -b video/phase-6-admin
```

### 6.2 Tests d'abord

Créer (cf. `07-tests-strategy.md` §4.7) :
- `lib/video/video-resolver.test.ts` (~5 cas).
- `app/api/admin/kit/video/route.test.ts` (~6 cas).
- `KitVideoEditor.test.tsx` (~12 cas).

### 6.3 Implémenter

1. Resolver + queries DB (si table dédiée) ou Component-Fields fallback.
2. API routes.
3. Admin UI (4 composants).
4. Page `/admin/kit/video`.

### 6.4 Valider

```bash
pnpm typecheck
pnpm vitest run video kit-video
pnpm --filter web dev
# Naviguer /admin/kit/video → modifier URL YouTube + chapitres + provenance.
# Save → toast.
# Publish → toast.
# Ouvrir /kit dans un autre onglet → modifs visibles.
# Reset → modale RESET-VIDEO → confirmer → /kit retombe sur le mock.
```

### 6.5 Commit

```bash
git commit -am "feat(video): phase 6 — admin éditeur kit/video"
```

---

## Phase 7 — Migration self-hosted

### 7.1 Pré-requis DA

Master vidéo livré : MP4 H.264 + WebM VP9 + WebVTT FR/AR + poster 1080×1920.

### 7.2 Branche

```bash
git checkout -b video/phase-7-self-hosted
```

### 7.3 Upload

1. Upload via `/admin/media` (3 fichiers : MP4, WebM, poster).
2. Récupérer les URLs publiques.

### 7.4 Bascule mock

Étendre `mockKitPageContent.videoSrc` :
```ts
sources: {
  mp4: 'https://cdn.femiglow.ma/v/rituel-gestes.mp4',
  webm: 'https://cdn.femiglow.ma/v/rituel-gestes.webm',
},
captions: {
  fr: 'https://cdn.femiglow.ma/v/rituel-gestes-fr.vtt',
  ar: 'https://cdn.femiglow.ma/v/rituel-gestes-ar.vtt',
},
```

### 7.5 Refactor `SelfHostedVariant`

Réutilise `VideoPosterCover` (mode `native`), `VideoChapters`, `VideoPostCta`.

### 7.6 Flag bascule

```bash
echo 'NEXT_PUBLIC_VIDEO_SOURCE=self_hosted' >> .env.local
```

### 7.7 Valider

```bash
pnpm vitest run VideoPlayer4Gestes
pnpm --filter web build
pnpm --filter web start
# Ouvrir /kit, vérifier qu'aucune iframe n'est dans le DOM.
# Vérifier les captions FR actives par défaut.
# Tracking : video_user_play, video_autoplay_view, video_complete OK.
```

### 7.8 Commit

```bash
git commit -am "feat(video): phase 7 — migration self-hosted master vidéo"
```

---

## Phase 8 — Playwright E2E

### 8.1 Branche

```bash
git checkout -b video/phase-8-e2e
```

### 8.2 Specs

Créer `apps/web/e2e/video/`:
- `render.spec.ts`
- `interaction.spec.ts`
- `admin.spec.ts`
- `a11y.spec.ts`

### 8.3 Valider

```bash
pnpm --filter web build
pnpm playwright install --with-deps
pnpm --filter web playwright test --grep '@video'
```

### 8.4 Commit

```bash
git commit -am "test(video): E2E Playwright + a11y axe"
```

---

## Phase 9 — Cleanup

### 9.1 Étendre README

Compléter `apps/web/src/components/kit/README.md` avec la section vidéo (4 composants).

### 9.2 Valider

```bash
pnpm typecheck
pnpm vitest run
pnpm --filter web build
```

### 9.3 Commit

```bash
git commit -am "chore(video): README handoff + cleanup"
```

---

## Validation cross-phases (avant merge final)

```bash
git checkout video-gestes-optim-2026-05
git rebase master

pnpm typecheck
pnpm -r lint
pnpm vitest run --coverage
# Vérifier couverture lib/video/** + components/kit/Video* >= 90%
pnpm playwright test --grep '@video'

pnpm --filter web build
```

## Post-déploiement prod

### Smoke tests

```bash
# Section vidéo présente
curl -s https://femiglow.ma/kit | grep -c "video-gestes"

# Pas d'iframe YouTube en mode self-hosted
curl -s https://femiglow.ma/kit | grep -c "youtube-nocookie"
# Attendu : 0 (en mode self_hosted)

# Provenance présente
curl -s https://femiglow.ma/kit | grep -oE "Filmé.{0,80}"
```

### Validation outils

- Lighthouse `/kit` : LCP ≤ 2,5 s, CLS ≤ 0,1.
- Axe browser ext. : 0 violation sur `/kit#video-gestes` et `/admin/kit/video`.
- Google Analytics : `video_complete` reçu en temps réel sur une session test.

### Monitoring 24-48 h

- Pas d'erreurs 5xx sur `/api/admin/kit/video/*`.
- Pas de spike de bounce sur `/kit` (proxy d'un crash visuel).
- Latence P95 `/kit` inchangée (± 5 %).

## Rollback global

```bash
# Désactiver les flags
NEXT_PUBLIC_VIDEO_V2=false
NEXT_PUBLIC_VIDEO_SOURCE=youtube
# Redéployer

# Si nécessaire, revert chaque phase
git revert <phase-9-sha>
git revert <phase-8-sha>
# … etc dans l'ordre inverse
```

## Aide-mémoire

| Action | Commande |
|---|---|
| Lancer un test ciblé | `pnpm vitest run <pattern>` |
| Playwright video | `pnpm playwright test --grep '@video'` |
| Type check | `pnpm typecheck` |
| Lint | `pnpm -r lint` |
| Build prod | `pnpm --filter web build` |
| Dev | `pnpm --filter web dev` |
| Coverage | `pnpm vitest run --coverage` |
| Reseed Component-Fields (phase 6) | `pnpm seed:components-fields:reconcile` |
| Inspect admin | `open http://localhost:3001/admin/kit/video` |
