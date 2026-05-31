# 08 — Plan d'action par phases

Découpage en 10 phases ordonnées. Chaque phase a son objectif, ses fichiers touchés, sa stratégie test-first, et ses critères de done.

## Phase 0 — Quick wins iframe (P0)

**Durée** : 0,5 j.
**Risque** : très faible.
**Dépendance** : aucune.

### 0.1 Étapes

1. **Tests d'abord** : étendre `YouTubeEmbed.test.tsx` (~4 cas) :
   - URL embed contient `mute=1`, `cc_load_policy=1`, `cc_lang_pref=fr` ;
   - `enablejsapi=1` uniquement si prop `enableJsApi` ;
   - props `mute`, `captions` honorées.
2. Étendre `lib/video/youtube-url.ts::buildYouTubeEmbedUrl` avec `mute`, `captions`, `enableJsApi`.
3. Modifier `VideoPlayer4Gestes.tsx` :
   - H2 : `Cinq gestes` → `Quatre gestes, en un seul plan.`
   - Fond `bg-creme-warm` → `bg-[#E8EDE3]`.
4. Run tests + typecheck + smoke preview.
5. Commit : `feat(video): phase 0 — quick wins iframe (mute/captions/titre/fond)`.

### 0.2 Fichiers touchés

- `apps/web/src/lib/video/youtube-url.ts` (étendre)
- `apps/web/src/lib/video/youtube-url.test.ts` (étendre)
- `apps/web/src/components/sections/YouTubeEmbed.tsx` (props ajoutées)
- `apps/web/src/components/sections/YouTubeEmbed.test.tsx` (étendre)
- `apps/web/src/components/sections/VideoPlayer4Gestes.tsx` (modifié)
- `apps/web/src/components/sections/VideoPlayer4Gestes.test.tsx` (étendre)

### 0.3 Critères de done

- Tests verts.
- URL embed inspectée : `mute=1&cc_load_policy=1&cc_lang_pref=fr` présents.
- Visuel : fond sauge pâle, H2 « Quatre gestes ».
- Aucune régression sur les tests existants.

---

## Phase 1 — Schema `RituelVideo` étendu

**Durée** : 0,5 j.
**Risque** : faible.
**Dépendance** : aucune.

### 1.1 Étapes

1. **Tests d'abord** : `page-content.test.ts` étendu avec `videoChapterSchema` et nouveaux champs (~15 cas).
2. Étendre `rituelVideoSchema` dans `lib/schemas/page-content.ts` : `chapters`, `posterCustom`, `provenance`, `durationDisplay`, `accentColor`.
3. Étendre `mockKitPageContent.videoSrc` (mock) avec les nouveaux champs.
4. Étendre `data/mock/kit.test.ts` (~3 cas).
5. Run tests + typecheck.
6. Commit : `feat(video): phase 1 — schema RituelVideo étendu (chapters/provenance/etc.)`.

### 1.2 Fichiers touchés

- `apps/web/src/lib/schemas/page-content.ts` (étendre)
- `apps/web/src/lib/schemas/page-content.test.ts` (créer ou étendre)
- `apps/web/src/data/mock/kit.ts` (étendre `videoSrc`)
- `apps/web/src/data/mock/kit.test.ts` (étendre)

### 1.3 Critères de done

- ≥ 18 tests Vitest verts.
- `mockKitPageContent` parsé sans erreur.
- Rétrocompat préservée (un `RituelVideo` sans aucun nouveau champ reste valide).

---

## Phase 2 — `VideoPosterCover` (click-to-play overlay)

**Durée** : 1 j.
**Risque** : moyen.
**Dépendance** : phase 1.

### 2.1 Étapes

1. **Tests d'abord** : `VideoPosterCover.test.tsx` (~10 cas).
2. Implémenter `components/kit/VideoPosterCover.tsx`.
3. Étendre `YouTubeEmbed` pour accepter une prop `autoplayOnMount` et un `iframeRef` externe (utile pour IFrame API phase 4).
4. Brancher dans `VideoPlayer4Gestes.tsx` (état `played`).
5. Run tests + smoke visuel.
6. Commit : `feat(video): phase 2 — VideoPosterCover click-to-play overlay`.

### 2.2 Fichiers touchés

- `apps/web/src/components/kit/VideoPosterCover.tsx` (nouveau)
- `apps/web/src/components/kit/VideoPosterCover.test.tsx` (nouveau)
- `apps/web/src/components/sections/YouTubeEmbed.tsx` (étendre props)
- `apps/web/src/components/sections/YouTubeEmbed.test.tsx` (étendre)
- `apps/web/src/components/sections/VideoPlayer4Gestes.tsx` (brancher)

### 2.3 Critères de done

- Tests poster verts.
- Au premier paint : poster custom (ou fallback `poster`) visible, pas d'iframe YouTube.
- Au clic : iframe monte avec autoplay + mute + captions FR.
- Bouton play 64×64 couleur d'accent visible et accessible clavier.

---

## Phase 3 — `VideoChapters` (mini-timeline cliquable)

**Durée** : 1 j.
**Risque** : moyen.
**Dépendance** : phase 1, phase 2 (pour iframe ref / seek).

### 3.1 Étapes

1. **Tests d'abord** : `lib/video/chapters.test.ts` (~8 cas) + `VideoChapters.test.tsx` (~10 cas).
2. Implémenter `lib/video/chapters.ts` (`formatTimestamp`, `activeChapterIndex`, `chapterProgress`).
3. Implémenter `components/kit/VideoChapters.tsx`.
4. Étendre `VideoIFrameTracker` (phase 4 préparée) pour exposer un `seekTo(seconds)` accessible via callback ref.
5. Brancher dans `VideoPlayer4Gestes.tsx` : `currentSeconds` state mis à jour par tracker.
6. Tests + smoke.
7. Commit : `feat(video): phase 3 — VideoChapters mini-timeline cliquable`.

### 3.2 Fichiers touchés

- `apps/web/src/lib/video/chapters.ts` (nouveau)
- `apps/web/src/lib/video/chapters.test.ts` (nouveau)
- `apps/web/src/components/kit/VideoChapters.tsx` (nouveau)
- `apps/web/src/components/kit/VideoChapters.test.tsx` (nouveau)
- `apps/web/src/components/sections/VideoPlayer4Gestes.tsx` (brancher)

### 3.3 Critères de done

- ≥ 18 tests verts.
- Timeline rendue avec 4 segments cliquables.
- Chapitre actif marqué `aria-current="true"` + underline accent.
- Click sur chapitre : tracking `video_chapter_click` + seek si tracker monté.

---

## Phase 4 — IFrame API tracker (`video_complete` + 25/50/75 %)

**Durée** : 0,5 j.
**Risque** : faible.
**Dépendance** : phase 2.

### 4.1 Étapes

1. **Tests d'abord** : `lib/video/iframe-tracker.test.ts` (~10 cas) — utilise le mock YouTube API.
2. Implémenter `lib/video/iframe-tracker.ts` (`loadYouTubeIframeApi`, `attachVideoTracker`).
3. Implémenter `components/kit/VideoIFrameTracker.tsx`.
4. Brancher dans `VideoPlayer4Gestes.tsx` après `played=true`.
5. Tests + smoke (lecture vidéo dans le browser, vérifier `video_complete` envoyé via DevTools Network).
6. Commit : `feat(video): phase 4 — IFrame API tracker (complete + 25/50/75)`.

### 4.2 Fichiers touchés

- `apps/web/src/lib/video/iframe-tracker.ts` (nouveau)
- `apps/web/src/lib/video/iframe-tracker.test.ts` (nouveau)
- `apps/web/src/components/kit/VideoIFrameTracker.tsx` (nouveau)
- `apps/web/src/components/kit/VideoIFrameTracker.test.tsx` (nouveau)
- `apps/web/src/test/mocks/youtube-iframe-api.ts` (nouveau — utilitaire de mock)
- `apps/web/src/components/sections/VideoPlayer4Gestes.tsx` (brancher)

### 4.3 Critères de done

- ≥ 10 tests verts.
- Mock YouTube IFrame API installé proprement (pas de pollution globale).
- `video_complete` reçu côté analytics en smoke réel.
- Graceful degradation : si script bloqué (ad-blocker), pas de crash.

---

## Phase 5 — Provenance + CTA post-vidéo

**Durée** : 0,5 j.
**Risque** : très faible.
**Dépendance** : phase 1.

### 5.1 Étapes

1. **Tests d'abord** : `VideoPlayer4Gestes.test.tsx` étendu (~5 cas).
2. Composant `VideoPostCta.tsx` (lien éditorial).
3. Rendu conditionnel `provenance` dans `VideoPlayer4Gestes.tsx`.
4. Tests + smoke.
5. Commit : `feat(video): phase 5 — provenance maison + CTA post-vidéo`.

### 5.2 Fichiers touchés

- `apps/web/src/components/kit/VideoPostCta.tsx` (nouveau)
- `apps/web/src/components/sections/VideoPlayer4Gestes.tsx` (modifié)
- `apps/web/src/components/sections/VideoPlayer4Gestes.test.tsx` (étendre)

### 5.3 Critères de done

- `provenance` rendue en italique Cormorant sous le sous-titre si présente.
- CTA `Voir le pack ci-dessous ↓` rendu après transcription, pointe `#commander-femiglow`.
- Aucun lien rendu si data absente.

---

## Phase 6 — Admin éditeur `/admin/kit/video`

**Durée** : 2 j.
**Risque** : moyen.
**Dépendance** : phase 1 mergée.

### 6.1 Étapes

1. **Tests d'abord** :
   - `composition-resolver`-style : `lib/video/video-resolver.test.ts` (~5 cas).
   - API : `app/api/admin/kit/video/route.test.ts` (~6 cas).
   - Form : `KitVideoEditor.test.tsx` (~12 cas).
2. Implémenter resolver (cascade override → mock).
3. Implémenter routes API (`GET`, `PATCH`, `POST /publish`, `POST /unpublish`, `POST /reset`).
4. Implémenter UI éditeur (`KitVideoEditor`, `VideoChaptersEditor`, `VideoPreviewCard`, `KitVideoResetDialog`).
5. Page `/admin/kit/video`.
6. Brancher `VideoPlayer4GestesBound` sur le resolver.
7. Tests + smoke admin complet.
8. Commit : `feat(video): phase 6 — admin éditeur kit/video`.

### 6.2 Fichiers touchés

- `apps/web/src/lib/video/video-resolver.ts` (nouveau)
- `apps/web/src/lib/video/schemas.ts` (Zod upsert)
- `apps/web/src/lib/db/queries/kit-video.ts` (nouveau, optionnel selon storage)
- API routes : `app/api/admin/kit/video/route.ts` + `/publish/route.ts` + `/unpublish/route.ts` + `/reset/route.ts`
- Admin UI : `KitVideoEditor.tsx`, `VideoChaptersEditor.tsx`, `VideoPreviewCard.tsx`, `KitVideoResetDialog.tsx`
- Page : `app/admin/kit/video/page.tsx`
- Tests (≈ 25 nouveaux)

### 6.3 Critères de done

- Form pré-rempli depuis l'override ou mock.
- Validation Zod live côté UI.
- Save → draft, Publish → live, Reset → mock fallback.
- `revalidateTag('kit-video')` déclenché à publish/unpublish/reset.
- Audit log alimenté.

---

## Phase 7 — Migration self-hosted (master vidéo)

**Durée** : 3 j (dont 1 j DA pour livrer le master).
**Risque** : moyen.
**Dépendance** : master vidéo livré par DA.

### 7.1 Étapes

1. DA produit / livre : MP4 H.264 + WebM VP9 + WebVTT FR/AR + poster custom 1080×1920.
2. Upload via `/admin/media` ou storage CDN (Vercel Blob).
3. Bascule `mockKitPageContent.videoSrc` : `youtubeUrl` reste mais `sources.{mp4,webm}` pointent vers master self-hosted.
4. Variante `SelfHostedVariant` refactorée pour utiliser `VideoPosterCover` (mode `native`), `VideoChapters`, etc.
5. Tests existants `SelfHostedVariant` migrés.
6. Flag `NEXT_PUBLIC_VIDEO_SOURCE='self_hosted'` activé.
7. Tests + smoke.
8. Commit : `feat(video): phase 7 — migration self-hosted master vidéo`.

### 7.2 Critères de done

- `/kit` rend la variante self-hosted (vérifié via DOM).
- Tracking `video_user_play`, `video_autoplay_view`, `video_complete` OK.
- Aucune iframe YouTube présente côté DOM.
- Captions FR par défaut.
- Performance : LCP ≤ 2,5 s.

---

## Phase 8 — Tests E2E + a11y

**Durée** : 1 j.
**Risque** : faible.
**Dépendance** : phases 0-6 mergées (7 optionnelle).

### 8.1 Étapes

1. Écrire les specs Playwright (`render.spec.ts`, `interaction.spec.ts`, `admin.spec.ts`, `a11y.spec.ts`).
2. Configurer fixtures auth admin (réutilise SEO).
3. Run local + CI.
4. Documenter flakes éventuels.
5. Commit : `test(video): E2E Playwright + a11y axe`.

### 8.2 Fichiers touchés

- `apps/web/e2e/video/*.spec.ts`
- `apps/web/e2e/fixtures/seed-video.ts`

### 8.3 Critères de done

- 100 % vert sur 3 runs consécutifs.
- 0 violation Axe sur `/kit#video-gestes` et `/admin/kit/video`.

---

## Phase 9 — Cleanup + handoff

**Durée** : 0,5 j.
**Risque** : très faible.
**Dépendance** : phases 0-8 mergées.

### 9.1 Étapes

1. Compléter `apps/web/src/components/kit/README.md` avec la section vidéo (déjà créé en phase composition).
2. Vérifier qu'aucun composant orphelin ne reste (grep `VideoPlayer4Gestes` → seulement bound + tests + définition).
3. Final commit : `chore(video): README handoff + cleanup`.

### 9.2 Critères de done

- README à jour.
- `pnpm typecheck`, `pnpm vitest run`, `pnpm playwright test --grep '@video'` verts.
- Build prod réussi.

---

## Vue d'ensemble — Gantt simplifié

```
Semaine 1
  Lundi      Phase 0 (0,5 j) + Phase 1 (0,5 j)
  Mardi      Phase 2 (1 j)
  Mercredi   Phase 3 (1 j)
  Jeudi      Phase 4 (0,5 j) + Phase 5 (0,5 j)
  Vendredi   Buffer

Semaine 2
  Lundi-Mardi  Phase 6 (admin, 2 j)
  Mercredi     Phase 8 (E2E + a11y, 1 j)
  Jeudi        Phase 9 (cleanup, 0,5 j) + buffer
  Vendredi     Buffer / smoke prod

Semaine 3 (selon livraison DA)
  Phase 7 (migration self-hosted, 3 j)
```

**Total** : ~10 j homme effectifs.

## Indicateurs de progression

Tableau de bord à maintenir dans `README.md` à chaque phase mergée :

```
| Phase | Statut       | Mergé main  | Déployé prod |
|-------|--------------|-------------|---------------|
| 0     | À faire      | -           | -             |
| 1     | À faire      | -           | -             |
| ...
```
