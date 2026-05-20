# 02 — Vision, objectifs, KPI

## 1. Vision

La section vidéo « Les gestes » est **le seul moment de la page où l'éditrice montre le rituel en action plutôt que de le raconter**. Elle doit faire ressentir, en 90 secondes maîtrisées, l'effet du kit sur la main — *avant* la décision d'achat. La pression conversion reste sur le Hero et le bloc « Le pack » ; ici, on densifie la preuve qualitative et on capte un signal d'engagement fort (`video_complete`) qui qualifie les leads.

Trois principes :

1. **Le geste avant les mots**. Le poster est une frame d'action, jamais un visage figé. Le bouton play est sauge profond, la cliente ne voit pas le rouge YouTube.
2. **La maison reste maître de la diffusion**. Aucun lien externe agressif, aucune marque tierce. La vidéo est encadrée par la voix maison (eyebrow, sous-titre, provenance, transcription).
3. **L'engagement vidéo qualifie le lead**. `video_complete` est un signal de plus haute intention que `add_to_cart` lui-même — il alimente le scoring conversion et le re-targeting.

## 2. Objectifs mesurables (OKR du plan)

| Objectif | Indicateur | Cible 2026-Q3 |
|---|---|---|
| Pénétration section | % de sessions /kit qui scrollent jusqu'à `section#video-gestes` (intersection 50 %) | ≥ 70 % |
| Engagement vidéo | Taux de lecture sur la cible « scrollers section » (= `video_user_play / video_section_view`) | ≥ 25 % desktop, ≥ 35 % mobile |
| Complétion | `video_complete / video_user_play` (taux de visualisation jusqu'au bout) | ≥ 45 % |
| Chapitres utilisés | `video_chapter_click / video_user_play` (engagement profond) | ≥ 8 % |
| Conversion post-vidéo | Taux de clic sur le CTA `Voir le pack ci-dessous` ou scroll vers `#commander-femiglow` dans les 60 s après `video_complete` | ≥ 12 % |
| Latence chargement section | LCP du poster custom (P75) | < 2,0 s mobile, < 1,2 s desktop |
| Bundle | Augmentation taille gzip du chunk `/kit` après livraison phases 0-6 | < 25 kB |
| Couverture tests | Lignes couvertes par les tests dans `components/kit/Video*`, `lib/video/**` | ≥ 90 % |
| A11y | Violations Axe sur `section#video-gestes` après phase 8 | 0 |
| Régression rendu | Tests E2E composition + video passants en CI sur chaque PR | 100 % (0 flake) |

## 3. Principes de design

### 3.1 Backend / data

- **Schema Zod source de vérité unique**. Toute extension passe par `rituelVideoSchema` + tests dédiés.
- **Champs additifs et rétrocompatibles**. `chapters`, `posterCustom`, `provenance`, `durationDisplay` sont optionnels. Le composant fonctionne sans qu'ils soient remplis (et les tests existants restent verts).
- **Validation au bord**. Côté API admin : Zod stricte. Côté rendu : le composant accepte la donnée tel quel mais sait gérer l'absence.
- **Cache par tag**. Revalidation chirurgicale via `revalidateTag('kit-video')` à chaque édition admin.

### 3.2 Frontend public

- **Composition de composants spécialisés**. `VideoPosterCover`, `VideoChapters`, `VideoIFrameTracker` — chacun avec sa responsabilité, testable isolément.
- **Click-to-play par défaut sur la variante YouTube**. La cliente voit toujours le poster maison en premier. L'iframe ne se monte qu'après interaction.
- **Native autoplay préservé sur la variante self-hosted** (variante future). Mêmes sous-composants, mode `'native'` au lieu de `'click-to-play'`.
- **`prefers-reduced-motion` respecté**. Pas de zoom-in poster, pas de slow-loop, lecture explicit-only.
- **Aucun JS critique above-the-fold**. La section vidéo est below-the-fold. Tout le tracking IFrame API est chargé après le premier clic.

### 3.3 Admin

- **Formulaire séquentiel**. URL YouTube → chapitres → poster custom → provenance → durationDisplay. Validation à chaque champ.
- **Aperçu live**. Le rendu de `VideoPosterCover` se met à jour à chaque modif.
- **Pas d'upload massif**. Le poster custom utilise le media picker existant (`OgImagePicker` modulaire récupéré du plan SEO).

### 3.4 Tests

- **Pyramide classique** : ~70 % unit, ~20 % MSW, ~10 % E2E.
- **Tests pures functions d'abord** : parsing chapters timecodes, validation Zod, calcul progression IFrame.
- **MSW pour les fetch admin** : la page éditeur teste sans backend.
- **Playwright sur 3 parcours** : visite section, clic poster → lecture → completion, navigation chapitres au clavier (a11y).

## 4. Anti-objectifs

Ce plan **ne vise pas à** :

- Forcer la lecture (no autoplay with sound — anti-pattern §4.4).
- Mettre en avant un lien « Watch on YouTube » externe (au contraire, le minimiser).
- Vendre la vidéo séparément. La vidéo reste un outil pédagogique gratuit, jamais un produit.
- Implémenter Sanity. Le mock TS reste source court terme.
- Remplacer le tracking côté serveur (`dispatchToProviders`). Le côté client n'envoie que les events `video_*` qui sont déjà dispatchés par les providers configurés (Meta, Snap, GA4).

## 5. Critères de succès global

Plan livré quand :

1. Tous les findings P0-P2 (phases 0 à 6) fermés en production.
2. Couverture tests `Video*` + `lib/video/**` ≥ 90 %.
3. Axe 0 violation sur `section#video-gestes` et `/admin/kit/video`.
4. Snapshot E2E Playwright stable 7 j consécutifs.
5. Un éditeur non-développeur peut, via `/admin/kit/video`, modifier l'URL source, les 4 chapitres, le poster custom et la provenance en moins de 90 s sans aide.
6. `video_complete` reçu côté analytics pour la variante YouTube (vérifié sur 1 session de test).
7. Phase 7 (migration self-hosted) reste documentée et activable dès livraison du master vidéo par la DA.
8. Documentation `apps/web/src/components/kit/README.md` à jour avec la section vidéo.

## 6. Gouvernance

- **Décideur produit** : fondateur du projet (cf. mémoire `user_role`).
- **Implémentation** : Claude Code en mode autonomous phases — pas de validation intermédiaire entre phases sauf rupture explicite (cf. mémoire `feedback_autonomous_phases`).
- **Validation** : runbook complet + smoke prod + revue KPIs à J+7 et J+30.
- **Rollback** :
  - Phase par phase : `git revert` du commit.
  - Feature flag global : `NEXT_PUBLIC_VIDEO_V2` (default `true` en staging puis prod après J+7).
  - Migration self-hosted : flag `NEXT_PUBLIC_VIDEO_SOURCE` = `'youtube' | 'self_hosted'` (default `'youtube'` tant que le master n'est pas livré).
