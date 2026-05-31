# 10 — Critères d'acceptation et non-régression

Checklist exhaustive pour valider chaque phase et garantir l'absence de régression.

## 1. Critères globaux (toute phase)

Avant merge :

- [ ] `pnpm typecheck` clean.
- [ ] `pnpm -r lint` clean.
- [ ] `pnpm vitest run` 100 % vert.
- [ ] `pnpm playwright test --grep '@video'` 100 % vert.
- [ ] Couverture `lib/video/**` ≥ 90 % branches.
- [ ] Couverture `components/kit/Video*` ≥ 85 % branches.
- [ ] Pas de `eslint-disable` non commenté ajouté.
- [ ] Pas de `console.log` oublié.
- [ ] Commits respectent la convention `feat(video)` / `test(video)` / `chore(video)`.
- [ ] Snapshot Playwright stable 3 runs consécutifs.

## 2. Phase 0 — Quick wins iframe

### 2.1 Acceptation

- [ ] URL iframe contient `mute=1`.
- [ ] URL iframe contient `cc_load_policy=1` et `cc_lang_pref=fr`.
- [ ] URL iframe contient `enablejsapi=1` uniquement quand prop `enableJsApi` passée.
- [ ] H2 affiche « Quatre gestes, en un seul plan. » (pas « Cinq »).
- [ ] Section utilise `bg-[#E8EDE3]` (sauge pâle).
- [ ] Aucune régression sur les tests existants `YouTubeEmbed`, `VideoPlayer4Gestes`.

### 2.2 Smoke test

```bash
pnpm --filter web dev
# Ouvrir /kit, scroller à la vidéo, inspecter l'iframe :
# attribut `src` doit contenir mute=1 + cc_load_policy=1 + cc_lang_pref=fr
```

## 3. Phase 1 — Schema étendu

### 3.1 Acceptation

- [ ] `rituelVideoSchema` accepte `chapters`, `posterCustom`, `provenance`, `durationDisplay`, `accentColor` optionnels.
- [ ] `chapters` exige ordre croissant `startSeconds` (validation Zod).
- [ ] `provenance` exige ponctuation finale.
- [ ] `accentColor` enum strict.
- [ ] `mockKitPageContent` passe `kitPageContentSchema` sans erreur.
- [ ] Les 4 chapitres du mock ont `startSeconds` triés.

### 3.2 Non-régression

- [ ] Tests `feed.xml`, `kit-feed`, `VideoPlayer4Gestes` existants passent.
- [ ] Un `RituelVideo` sans aucun champ étendu reste valide.

## 4. Phase 2 — `VideoPosterCover`

### 4.1 Acceptation

- [ ] Au paint initial : poster (custom ou fallback) visible, pas d'iframe.
- [ ] Bouton play 64×64 centré, couleur de l'accent.
- [ ] `aria-label` du bouton dérivé de l'`alt` du poster.
- [ ] Click sur poster → iframe monte avec `autoplay=1&mute=1&cc_load_policy=1`.
- [ ] Badge `durationDisplay` affiché en bas-gauche du poster si fourni.
- [ ] Si `posterCustom` absent, fallback sur `poster` + voile encre 15 %.
- [ ] `prefers-reduced-motion: reduce` désactive le scale hover.

### 4.2 Non-régression

- [ ] Tests `YouTubeEmbed` continuent de passer.
- [ ] Si `youtubeUrl` absent → variante self-hosted prend le relais.

## 5. Phase 3 — `VideoChapters`

### 5.1 Acceptation

- [ ] `<nav aria-label="Chapitres de la vidéo">` rendue.
- [ ] 4 segments cliquables avec numérotation `01`/`02`/`03`/`04`.
- [ ] Labels courts (≤ 24 chars) tiennent sur 4 colonnes mobile.
- [ ] Timestamp formaté `0:18` / `1:05` (tabular-nums).
- [ ] Chapitre actif a `aria-current="true"` + underline accent.
- [ ] Click sur chapitre : tracking `video_chapter_click` + seek si tracker monté.
- [ ] Focus visible au clavier (ring champagne).

### 5.2 Non-régression

- [ ] Si `chapters` absent du SubProduct → pas de timeline rendue.
- [ ] Si `chapters.length < 2` → pas de timeline rendue.

## 6. Phase 4 — IFrame API tracker

### 6.1 Acceptation

- [ ] `loadYouTubeIframeApi` charge le script une seule fois (idempotent).
- [ ] `video_complete` émis à `PlayerState.ENDED`.
- [ ] `video_progress_25` / `_50` / `_75` émis aux franchissements respectifs.
- [ ] Pas de double émission d'un palier déjà franchi.
- [ ] Cleanup à l'unmount arrête l'interval (pas de leak).
- [ ] Graceful degradation : si script bloqué, la lecture vidéo reste OK (juste pas de tracking enrichi).

### 6.2 Non-régression

- [ ] L'iframe reste sur `youtube-nocookie.com`.
- [ ] Pas de nouveaux cookies tiers Set-Cookie côté site.

## 7. Phase 5 — Provenance + CTA post

### 7.1 Acceptation

- [ ] `provenance` rendue en italique Cormorant sous le sous-titre si présente.
- [ ] CTA `Voir le pack ci-dessous ↓` rendu après transcription.
- [ ] CTA pointe vers `#commander-femiglow`.
- [ ] Click CTA scroll smooth vers la section pack.

### 7.2 Non-régression

- [ ] Si `provenance` absent → pas de ligne italique.
- [ ] Aucune régression sur la transcription accordéon.

## 8. Phase 6 — Admin éditeur

### 8.1 Acceptation `/admin/kit/video`

- [ ] Form pré-rempli depuis l'override DB ou mock fallback.
- [ ] Detection live URL YouTube valide (vert).
- [ ] Validation Zod live côté UI (erreurs affichées sous chaque champ).
- [ ] Aperçu live à droite met à jour à chaque keystroke.
- [ ] Save → toast « Brouillon enregistré ».
- [ ] Publish désactivé tant que dirty.
- [ ] Reset ouvre modale avec saisie `RESET-VIDEO`.
- [ ] Reset confirmé → DELETE override + retour mock.

### 8.2 Acceptation API

- [ ] `GET /api/admin/kit/video` exige session admin (401 sinon).
- [ ] `PATCH` valide body via Zod (422 si invalide).
- [ ] `POST /publish` revalide `tag('kit-video')` + `path('/kit')`.
- [ ] `POST /reset` supprime l'override DB + log audit.

### 8.3 Non-régression

- [ ] Pages admin existantes (`/admin/seo`, etc.) restent fonctionnelles.
- [ ] Cascade `mock → override → publish` cohérente.
- [ ] Audit events `kit_video.*` posés dans `auditEvents`.

## 9. Phase 7 — Migration self-hosted

### 9.1 Acceptation

- [ ] `/kit` ne contient plus aucune iframe YouTube en mode `self_hosted`.
- [ ] Master vidéo MP4 + WebM chargés depuis CDN.
- [ ] Captions FR par défaut actives (track `default`).
- [ ] Tracking `video_user_play`, `video_autoplay_view`, `video_complete` OK.
- [ ] LCP `/kit` ≤ 2,5 s.

### 9.2 Non-régression

- [ ] Bascule flag `NEXT_PUBLIC_VIDEO_SOURCE=youtube` réactive la variante YouTube sans crash.
- [ ] Variantes partagent les mêmes sous-composants (`VideoPosterCover` mode `native`, `VideoChapters`, etc.).

## 10. Phase 8 — E2E

### 10.1 Acceptation

- [ ] Spec `@video-render` : section visible, 4 chapitres, badge durée.
- [ ] Spec `@video-interaction` : click poster monte iframe, click chapitre seek, CTA scroll.
- [ ] Spec `@video-admin` : parcours nominal édition + publish + reset.
- [ ] Spec `@video-a11y` : 0 violation axe sur `/kit#video-gestes` et `/admin/kit/video`.
- [ ] Aucun flake en 5 runs consécutifs.

### 10.2 Non-régression

- [ ] Tous les autres tags Playwright (`@kit`, `@composition`, `@og`, etc.) restent verts.

## 11. Critères de non-régression globaux

### 11.1 Métadonnées critiques

- [ ] `<title>` `/kit` inchangé.
- [ ] `<meta name="description">` `/kit` inchangé.
- [ ] JSON-LD `Product` reste valide.
- [ ] Section composition (refonte précédente) reste fonctionnelle.

### 11.2 Performance

- [ ] LCP `/kit` ≤ 2,5 s mobile.
- [ ] CLS ≤ 0,1.
- [ ] FID ≤ 100 ms.
- [ ] Bundle size augmentation gzip ≤ 25 kB sur toute la refonte.

### 11.3 Accessibilité

- [ ] `/kit` axe 0 violations (post phase 8).
- [ ] `/admin/kit/video` axe 0 violations.
- [ ] Navigation clavier complète sur la section.
- [ ] Focus visible sur tous les éléments interactifs.

### 11.4 Comportement public

- [ ] Click poster déclenche lecture en < 200 ms.
- [ ] `prefers-reduced-motion` désactive les transitions visuelles.
- [ ] Le CTA `Voir le pack ci-dessous` scroll vers `#commander-femiglow`.
- [ ] Aucun lien externe agressif visible (pas de « Watch on YouTube » mis en avant).

### 11.5 Comportement admin (post phase 6)

- [ ] Édition save → publish → revalidation visible sur `/kit` en < 5 s.
- [ ] Reset → mock revient en < 2 s.
- [ ] Modale reset bloque tant que `RESET-VIDEO` non saisi correctement.

## 12. Sign-off

Une phase est close quand :

1. Toutes les cases à cocher de sa section sont validées.
2. PR review approuvée (ou auto-revue documentée).
3. Smoke tests post-déploiement passés.
4. Aucune alerte 5xx dans les 24 h suivant le déploiement.

Le plan global est livré quand :

- Phases 0-9 closes (phase 7 peut suivre selon livraison DA).
- Couverture tests atteinte.
- KPIs `02-vision-objectifs.md` §2 mesurés et conformes.
- Documentation `apps/web/src/components/kit/README.md` à jour.
- Un éditeur non-développeur a publié une modification via `/admin/kit/video` en < 90 s sans aide.
