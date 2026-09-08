# 04 — Plan d'action technique (phasé)

Principe : **livrer derrière un feature flag `STORIES_ENABLED` (OFF par défaut)**, chaque phase
testée et réversible. Ordre pensé pour voir le composant vivant tôt (P1) tout en gardant la cible
maintenable (schéma dédié).

---

## P0 — Socle données & médias
**But** : avoir des vidéos réelles + le modèle de feed + les events tracking.

- [ ] **Seed vidéos** : uploader 2–3 stories de clips via `/admin/media/upload` (déclenche ffmpeg
      → variants `mp4`/`webm` + poster). Vérifier `media.kind='video'`, `status='ready'`,
      `originalDurationMs` renseigné, variant `format='poster'` présente.
- [ ] **Schéma feed (Option A)** : migration `media_story` + `media_story_segment`
      (`src/lib/db/schema.ts` + `drizzle/migrations/00XX_media_stories.sql` via drizzle-kit),
      puis `db:migrate-safe`.
- [ ] **Types & feed** : `src/lib/stories/types.ts` (StoryFeed/Story/StorySegment) +
      `src/lib/stories/feed.ts` (`getStoriesFeed(locale)` : join stories→segments→media/variants,
      `is_active`, tri `display_order`, cache `unstable_cache` tag `'stories'`).
- [ ] **Tracking** : ajouter `story_*` à `event-catalog.ts` + `schemas.ts` (+ normalisation
      `story_cta_click → cta_click` comme `pack_cta_click`).
- [ ] Seed de dev : `scripts/seed-stories.ts` (relie les vidéos seedées à des stories).

**Livrable** : `getStoriesFeed('fr')` renvoie un `StoryFeed` non vide. Tests unitaires feed verts.

---

## P1 — Composant + intégration (flag OFF)
**But** : le rail + le viewer fonctionnels sur `/kit`, activables par flag.

- [ ] `StoriesRail.tsx` — bulles scroll-snap (poster only, anneau vu/non-vu via
      `src/lib/stories/seen.ts`), a11y, RTL.
- [ ] `StoryViewer.tsx` — overlay portal : barres de progression, tap-zones, long-press pause,
      swipe, mute, close, auto-advance, préchargement du seul segment suivant. Player = `<video>`
      calqué `SelfHostedVariant` ou `MediaVideoClient` (`strategy` interaction/viewport).
- [ ] `StoriesVideo.tsx` — orchestrateur : `StoriesRail` + `dynamic(() => import('./StoryViewer'),
      {ssr:false})`, gestion de l'état ouvert/segment courant.
- [ ] `StoriesVideoBound.tsx` — RSC : `getStoriesFeed` + `getTranslations` → props.
- [ ] **Registry** : seed `kit-stories-video` (`registry.ts`) + `sync:components`.
- [ ] **Page** : `<StoriesVideoBound/>` dans `KitPageLayoutV2.tsx` après `HeroProduitBound`,
      gardé par `STORIES_ENABLED` (`src/lib/feature-flags/stories.ts`).
- [ ] **i18n** : namespace `marketing.kit.stories` dans `messages/{fr,ar,en}.json`.
- [ ] **Tracking câblé** : `story_open/view/complete/next/prev/pause/close/cta_click` + CTA via
      logique `CommanderAnchorButton` (ancre `#commander-femiglow`, `add_to_cart`).
- [ ] **Preview admin** : entrée `kit-stories-video` dans `MIGRATED_COMPONENTS`
      (`render-by-key.tsx`).

**Livrable** : flag ON en preview → bulles visibles, viewer jouable, CTA → wizard, events émis.
Payload initial inchangé (mesuré : aucun `.mp4` chargé avant ouverture).

---

## P2 — Admin CRUD + robustesse vidéo
**But** : gestion autonome des stories + meilleur service vidéo.

- [ ] **Admin stories** : `src/app/admin/stories/` (liste, création, ordre, activation) +
      binding média (choisir vidéos + poster de bulle), sur le modèle de l'admin média/composants.
- [ ] **HTTP Range** : support `Range`/`206`/`Accept-Ranges` pour `video/*` dans
      `src/app/media-files/[...path]/route.ts` (+ tests).
- [ ] **Option CDN** : documenter le passage `MEDIA_STORAGE_DRIVER=vercelBlob` pour la vidéo en
      prod (whitelist CSP `media-src` du host CDN si applicable).

**Livrable** : une personne non-dev crée/ordonne une story ; seek vidéo fonctionnel.

---

## P3 — Analytics & A/B
**But** : mesurer et optimiser.

- [ ] **Funnel stories** dans l'analytics existant (onglet dédié ou vue) : impression → open →
      view → complete → cta → add_to_cart → purchase, par `story_id`.
- [ ] **A/B position** : flag `STORIES_PLACEMENT` (après Hero vs avant Commander), mesure
      conversion attribuée (aligné playbook Kolenda).
- [ ] Mapping GTM des events `story_*` si diffusion providers souhaitée.

---

## P4 — Durcissement
- [ ] Perf audit (Lighthouse mobile : LCP/CLS inchangés, TBT du viewer acceptable au 1ᵉʳ open).
- [ ] Edge cases : feed vide, vidéo `failed`, réseau lent (poster + spinner), offline.
- [ ] Revue a11y complète (lecteur d'écran, focus trap, clavier) + reduced-motion.
- [ ] Nettoyage : retirer l'Option B (POC) si utilisée, figer le schéma.

---

## Fichiers — récap create / modify
**Créer** : `src/components/sections/{StoriesVideo,StoriesRail,StoryViewer,StoriesVideoBound}.tsx`
(+ `*.test.tsx`), `src/lib/stories/{types,feed,seen}.ts`, `src/lib/feature-flags/stories.ts`,
`drizzle/migrations/00XX_media_stories.sql`, `scripts/seed-stories.ts`, admin `src/app/admin/stories/*` (P2).
**Modifier** : `src/lib/db/schema.ts`, `src/lib/components/registry.ts`,
`src/lib/components/render-by-key.tsx`, `src/components/marketing/kit-layout/KitPageLayoutV2.tsx`,
`src/lib/tracking/event-catalog.ts`, `src/lib/tracking/schemas.ts`,
`messages/{fr,ar,en}.json`, `src/app/media-files/[...path]/route.ts` (P2),
`src/components/sections/index.ts` (barrel).

## Décisions ouvertes (à trancher avant P1)
1. **Absorber `Video4Gestes`** dans une story, ou garder les deux ? (recommandé : en faire une story).
2. **Option A (schéma dédié) dès P1**, ou POC Option B d'abord ? (recommandé : A directement si le
   temps le permet — évite une dette).
3. **Placement** primaire confirmé après Hero ? (à A/B en P3).
4. **Vidéos** : self-hosted only, ou CDN dès la prod ? (recommandé : self-hosted clips courts en
   P1, CDN en P2 si volumétrie).
