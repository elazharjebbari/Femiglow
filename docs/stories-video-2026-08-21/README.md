# Stories vidéo shoppables — dossier de conception & d'exécution

**Date** : 2026-08-21 · **Cible** : page `/kit` (FemiGlow) · **Statut** : plan (non implémenté)

Composant « Stories » façon Instagram : un **rail de bulles/highlights cliquables** qui ouvrent
un **viewer plein écran vertical (9:16)** enchaînant des clips vidéo, avec CTA d'achat intégré.
Objectif : maximiser l'engagement et la **conversion** sans alourdir la page.

## Index du dossier
1. [`01-recherche-conversion.md`](01-recherche-conversion.md) — pourquoi ça convertit, benchmarks, **positionnement** sur `/kit`, stratégie de contenu.
2. [`02-ui-ux-fonctionnement.md`](02-ui-ux-fonctionnement.md) — UI/UX détaillée : bulles, viewer, gestes, contrôles, états, RTL, accessibilité.
3. [`03-architecture-integration.md`](03-architecture-integration.md) — architecture composant, **modèle du feed vidéo**, stratégie de payload, service vidéo (gap Range), tracking, intégration page/registry.
4. [`04-plan-action-technique.md`](04-plan-action-technique.md) — plan d'action phasé (P0→P4), fichiers à créer/modifier, décisions techniques.
5. [`05-tests-runbook.md`](05-tests-runbook.md) — stratégie de tests (vitest/MSW/Playwright) + **runbook d'exécution**.

## Résumé exécutif

**Le format.** Les Stories sont le format le plus « natif mobile » qui existe : compréhension
immédiate (tap pour avancer, maintien pour pause), plein écran vertical, rythme contrôlé par
l'utilisateur. En e-commerce ils cumulent **preuve sociale** (usage réel, avant/après),
**pédagogie produit** (les 4 gestes) et **CTA shoppable** au bon moment — trois leviers de
conversion réunis dans un seul format à faible friction.

**Deux surfaces distinctes** :
- **Le rail de bulles** — inline sur la page, léger (uniquement des posters WebP ~5–15 kB
  chacun), quasi zéro impact sur le poids initial. Réutilise le pattern scroll-snap CSS de
  `HandsTestimonialCarousel` (pas de librairie).
- **Le viewer** — overlay plein écran monté **uniquement au tap** (code-splitté via
  `next/dynamic`, `ssr:false`), donc **0 coût de layout et 0 JS/vidéo tant qu'aucune bulle
  n'est ouverte**. C'est le cœur de « ne pas surcharger la page pour rien ».

**Positionnement recommandé** (détaillé en §01) : rail de bulles **juste après le Hero**
(position 2 dans `KitPageLayoutV2.tsx`), car les bulles ajoutent peu de hauteur et offrent un
hook social-proof précoce ; le viewer étant un overlay, il ne pousse aucun contenu. Un second
rail optionnel près de la section Commander. Le tout **derrière un feature flag** pour A/B tester
la position (aligné au playbook Kolenda, cf. [[docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md]]).

**Trois décisions techniques structurantes** (détaillées en §03/§04) :
1. **Payload** : posters-first au chargement, viewer + sources vidéo montés à la demande, préchargement du **seul** segment suivant. On calque la stratégie éprouvée de `VideoPosterCover`/`MediaVideoClient` (`strategy="interaction"`/`"viewport"`).
2. **Feed vidéo** : nouveau modèle léger `media_story` + `media_story_segment` (référence `media.kind='video'` + poster), ordonnable et localisable — plus maintenable qu'un détournement du système de slots. MVP possible via tag `stories` + query custom en attendant l'admin.
3. **Service vidéo** : le handler `/media-files` **ne gère pas les requêtes HTTP Range** (pas de seek/streaming partiel) → acceptable pour des clips courts (5–15 s, faststart), mais on ajoute le support Range en P2, ou on sert via CDN en prod. **Aucune vidéo n'est seedée aujourd'hui** → P0 inclut l'upload/seed.

**Tracking** : nouveaux events `story_open / story_view / story_complete / story_next /
story_prev / story_pause / story_close / story_cta_click` ajoutés au catalogue, plus réutilisation
de `video_progress` / `video_complete` / `cta_impression` / `add_to_cart`. Attribution par
`story_id` + `segment_id` pour mesurer le funnel bulle → vue → CTA → panier → achat.

**Périmètre d'exécution** : 5 phases, du socle data (P0) au composant + intégration flaggée (P1),
puis admin CRUD + Range (P2), analytics + A/B (P3), durcissement (P4). Chaque phase est
testée (unit/interaction/E2E) et pilotée par le runbook §05.
