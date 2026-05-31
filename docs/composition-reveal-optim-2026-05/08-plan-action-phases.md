# 08 — Plan d'action par phases

Découpage exécution en 9 phases ordonnées. Chaque phase a son objectif, ses fichiers touchés, sa stratégie test-first, et ses critères de done.

## Phase 0 — Quick wins visuels (P0)

**Durée** : 0,5 j.
**Risque** : très faible.
**Dépendance** : aucune.
**Feature flag** : aucun.

### 0.1 Étapes

1. **Tests d'abord** (snapshot léger) :
   - `CompositionReveal.test.tsx` (nouveau, 2 cas) : snapshot du DOM rendu avec mock baseline.
2. Modifier `CompositionReveal.tsx` :
   - Fond `bg-creme` → `bg-[#EFE9DD]`.
3. Modifier `ProductCard.tsx` (temporaire — sera supprimé phase 2) :
   - Bordure `border border-[#C7CCC2]` + fond `bg-[#FBFAF6]` + padding `p-4 sm:p-5`.
   - Volume inline avec le titre (`· {volume.toLowerCase()}`).
   - Lien `Voir la composition` → `Lire le détail`.
4. **Pas encore** de pastille numérotée (introduite dans `CompositionCard` phase 2).
5. Run `pnpm vitest run CompositionReveal` + `pnpm typecheck`.
6. Commit : `feat(composition): phase 0 — quick wins visuels Kolenda`.

### 0.2 Fichiers touchés

- `apps/web/src/components/sections/CompositionReveal.tsx` (modifié)
- `apps/web/src/components/sections/CompositionReveal.test.tsx` (nouveau)
- `apps/web/src/components/commerce/ProductCard.tsx` (modifié, temporaire)

### 0.3 Critères de done

- Snapshot test vert.
- `pnpm typecheck` clean.
- Visuel manuel : fond sable, bordures cards, volume inline, lien renommé.

---

## Phase 1 — Schema `SubProduct` étendu (P1)

**Durée** : 0,5 j.
**Risque** : faible.
**Dépendance** : phase 0.

### 1.1 Étapes

1. **Tests d'abord** : créer `apps/web/src/lib/schemas/product.test.ts` avec ~12 cas (cf. `07-tests-strategy.md` §4.2).
2. Étendre `subProductSchema` avec `sensation`, `contextualImage`, `accentColor` (cf. `03-data-model.md` §2).
3. Créer `apps/web/src/data/mock/kit.test.ts` (3 cas).
4. Étendre `mockKitPageContent` dans `apps/web/src/data/mock/kit.ts` avec sensation + accentColor pour les 3 sous-produits.
5. Run `pnpm vitest run product schema mock kit` + `pnpm typecheck`.
6. Commit : `feat(composition): phase 1 — schema SubProduct + mock enrichi`.

### 1.2 Fichiers touchés

- `apps/web/src/lib/schemas/product.ts` (étendu)
- `apps/web/src/lib/schemas/product.test.ts` (nouveau)
- `apps/web/src/data/mock/kit.ts` (étendu)
- `apps/web/src/data/mock/kit.test.ts` (nouveau)

### 1.3 Critères de done

- 15+ nouveaux tests Vitest verts.
- `mockKitPageContent` parsé sans erreur par `kitPageContentSchema`.
- Aucun consommateur existant cassé (`feed.xml`, `kit-feed`, etc.).

---

## Phase 2 — `CompositionCard` dédié (P1)

**Durée** : 1 j.
**Risque** : faible.
**Dépendance** : phase 1 mergée.

### 2.1 Étapes

1. **Tests d'abord** :
   - `apps/web/src/lib/composition/copy.test.ts` (~10 cas) — fonctions pures.
   - `apps/web/src/components/kit/CompositionCard.test.tsx` (~12 cas).
   - `apps/web/src/components/kit/NumberBadge.test.tsx` (~4 cas).
   - `apps/web/src/components/kit/SensationLine.test.tsx` (~3 cas).
2. Implémenter `lib/composition/copy.ts` (cf. `04-backend-design.md` §3.1).
3. Implémenter `components/kit/NumberBadge.tsx`, `SensationLine.tsx`.
4. Implémenter `components/kit/CompositionCard.tsx` (sans crossfade encore — image isolated seule).
5. Brancher `CompositionReveal.tsx` sur `CompositionCard` au lieu de `ProductCard`. Garder `ProductCard` non utilisé (suppression phase 8).
6. Run tests + typecheck.
7. Commit : `feat(composition): phase 2 — CompositionCard dédié + sensation + pastille`.

### 2.2 Fichiers touchés

- `apps/web/src/lib/composition/copy.ts` (nouveau)
- `apps/web/src/lib/composition/copy.test.ts` (nouveau)
- `apps/web/src/components/kit/CompositionCard.tsx` (nouveau)
- `apps/web/src/components/kit/CompositionCard.test.tsx` (nouveau)
- `apps/web/src/components/kit/NumberBadge.tsx` (nouveau)
- `apps/web/src/components/kit/NumberBadge.test.tsx` (nouveau)
- `apps/web/src/components/kit/SensationLine.tsx` (nouveau)
- `apps/web/src/components/kit/SensationLine.test.tsx` (nouveau)
- `apps/web/src/components/sections/CompositionReveal.tsx` (modifié)

### 2.3 Critères de done

- 30+ tests Vitest verts (cumulatif).
- Snapshot DOM de `CompositionReveal` mis à jour avec la nouvelle structure (pastille, sensation, bordure).
- Couverture `lib/composition/copy.ts` ≥ 95 % branches.

---

## Phase 3 — Image contextuelle au hover/tap (P2)

**Durée** : 1 j.
**Risque** : moyen.
**Dépendance** : phase 2.
**Feature flag** : `NEXT_PUBLIC_COMPOSITION_CONTEXTUAL` (default `false`, activé en staging puis prod).

### 3.1 Étapes

1. **Tests d'abord** : `apps/web/src/components/kit/MediaCrossfade.test.tsx` (~8 cas — toggle click/Enter/Space/tap, a11y).
2. Implémenter `components/kit/MediaCrossfade.tsx`.
3. Implémenter `lib/composition/media.ts::resolveContextualSlot` (server-only).
4. Étendre `CompositionRevealBound.tsx` pour résoudre les 3 nouveaux slots.
5. Brancher `MediaCrossfade` dans `CompositionCard`.
6. Étendre Component-Media : 3 nouveaux slots dans `kit-comparatif` (`kit-base-contextual`, `kit-fortifiant-contextual`, `kit-lime-contextual`).
7. **Visuels** : à produire en parallèle (DA). En attendant la DA, les slots restent vides → fallback isolated seul (rétrocompat).
8. Commit : `feat(composition): phase 3 — image contextuelle au hover/tap`.

### 3.2 Fichiers touchés

- `apps/web/src/components/kit/MediaCrossfade.tsx` (nouveau)
- `apps/web/src/components/kit/MediaCrossfade.test.tsx` (nouveau)
- `apps/web/src/lib/composition/media.ts` (nouveau)
- `apps/web/src/components/sections/CompositionRevealBound.tsx` (modifié)
- Registry Component-Media (`apps/web/src/lib/components/registry.ts` + seed)

### 3.3 Critères de done

- Tests crossfade verts.
- E2E Playwright (phase 7) : hover desktop déclenche crossfade ; tap mobile toggle.
- A11y : `role="button"`, `aria-pressed`, navigation clavier OK.

---

## Phase 4 — Animations reveal au scroll (P2)

**Durée** : 0,5 j.
**Risque** : faible.
**Dépendance** : phase 2.

### 4.1 Étapes

1. **Tests d'abord** : étendre `CompositionCard.test.tsx` avec ~4 cas motion.
2. Wrapper `<article>` de `CompositionCard` avec `motion.article` (Framer Motion `whileInView`).
3. Configurer `MotionConfig` global avec `reducedMotion="user"` (respect prefers-reduced-motion).
4. Run tests + manual scroll test.
5. Commit : `feat(composition): phase 4 — reveal animations Framer Motion`.

### 4.2 Fichiers touchés

- `apps/web/src/components/kit/CompositionCard.tsx` (modifié)
- `apps/web/src/components/kit/CompositionCard.test.tsx` (étendu)
- `apps/web/src/app/(marketing)/kit/layout.tsx` ou parent commun (ajout `MotionConfig` si pas déjà)

### 4.3 Critères de done

- Animation visible au scroll, stagger 120 ms.
- `prefers-reduced-motion: reduce` → pas d'animation (Framer Motion respecte).
- Pas de jank — `requestIdleCallback` ou `whileInView` only.

---

## Phase 5 — Vue éclatée annotée (P3)

**Durée** : 1,5 j (dont 1 j DA pour produire le visuel).
**Risque** : moyen.
**Dépendance** : phase 2.

### 5.1 Étapes

1. **DA produit** le visuel : photo top-view des 3 produits étalés + annotations lignes fines, format 1600×900 PNG/AVIF, fond sable. Sortie : 1 image responsive (md, lg, xl variantes).
2. **Tests d'abord** : `CompositionReveal.test.tsx` étendu avec ~2 cas (figure rendue si fournie, omise sinon).
3. Étendre `KitPageContent` : `composition.exploded?: { src, alt, width, height }` (optionnel).
4. Rendu de la `<figure>` dans `CompositionReveal` avant la grille (cf. `05-frontend-public-design.md`).
5. Component-Media : nouveau slot `kit-exploded` sous `kit-comparatif`.
6. Run tests + smoke visuel.
7. Commit : `feat(composition): phase 5 — vue éclatée annotée`.

### 5.2 Fichiers touchés

- DA : assets PNG/AVIF produits.
- `apps/web/src/lib/schemas/page-content.ts` (extension optionnelle)
- `apps/web/src/components/sections/CompositionReveal.tsx` (modifié)
- `apps/web/src/components/sections/CompositionReveal.test.tsx` (étendu)
- Component-Media registry (slot `kit-exploded`)

### 5.3 Critères de done

- Visuel intégré, responsive sur 3 breakpoints.
- Tests verts.
- LCP `/kit` ≤ 2,5 s (cible WebVitals).

---

## Phase 6 — Admin éditeur (P3)

**Durée** : 2 j.
**Risque** : moyen.
**Dépendance** : phase 1 mergée, phase 2 livrée.
**Feature flag** : aucun (route admin, accès limité).

### 6.1 Étapes

1. **Tests d'abord** :
   - API : `app/api/admin/kit/composition/[id]/route.test.ts` (~6 cas).
   - Resolver : `lib/composition/composition-resolver.test.ts` (~5 cas).
   - Form : `components/admin/kit/KitCompositionEditor.test.tsx` (~12 cas).
2. Migration DB (option facultative — voir `03-data-model.md` §7.3). Si jugée hors scope court terme, persister via Component-Fields existants.
3. Implémenter routes API.
4. Implémenter resolver `resolveKitComposition()` avec cascade override → mock.
5. Implémenter UI éditeur (`KitCompositionEditor`, `CompositionPreviewCard`, `AccentColorPicker`, etc.).
6. Page `/admin/kit/composition/[id]` + index `/admin/kit/composition`.
7. Brancher `KitPage` sur `resolveKitComposition()` au lieu de `content.composition` direct.
8. Run tests + manual smoke admin.
9. Commit : `feat(composition): phase 6 — admin éditeur sous-produits`.

### 6.2 Fichiers touchés

- API : `app/api/admin/kit/composition/route.ts`, `[id]/route.ts`, `[id]/publish/route.ts`, `[id]/unpublish/route.ts`, `[id]/reset/route.ts`.
- Resolver : `lib/composition/composition-resolver.ts`.
- Admin UI : `components/admin/kit/KitCompositionList.tsx`, `KitCompositionEditor.tsx`, `CompositionPreviewCard.tsx`, `AccentColorPicker.tsx`, `IngredientsListEditor.tsx`, `CertificationsListEditor.tsx`, `KitCompositionResetDialog.tsx`.
- Page : `app/admin/kit/composition/page.tsx`, `[id]/page.tsx`.
- Schemas : `lib/composition/schemas.ts`.
- Tests (~30 nouveaux).

### 6.3 Critères de done

- Index `/admin/kit/composition` liste 3 cards.
- Éditeur `/admin/kit/composition/1-paste` : save → draft, publish → live, reset → mock fallback.
- Cache revalidation OK (test E2E phase 7).
- Audit log alimenté (3 actions × 3 sous-produits possibles).

---

## Phase 7 — Tests E2E Playwright + a11y (P3)

**Durée** : 1 j.
**Risque** : faible.
**Dépendance** : phases 0-6 mergées.

### 7.1 Étapes

1. Écrire les spécs Playwright (cf. `07-tests-strategy.md` §4.8).
2. Configurer fixtures auth admin (réutilise SEO).
3. Run en local + CI.
4. Documenter les flakes éventuels.
5. Commit : `test(composition): E2E Playwright + a11y axe`.

### 7.2 Fichiers touchés

- `apps/web/e2e/composition/render.spec.ts`
- `apps/web/e2e/composition/interaction.spec.ts`
- `apps/web/e2e/composition/admin.spec.ts`
- `apps/web/e2e/composition/a11y.spec.ts`
- `apps/web/e2e/fixtures/seed-composition.ts`

### 7.3 Critères de done

- 100 % des specs vertes en local et CI 3 runs consécutifs.
- 0 violations Axe sur `/kit` et `/admin/kit/composition/*`.
- Latence section `composition-title` visible < 200 ms après scroll.

---

## Phase 8 — Cleanup + handoff (P3)

**Durée** : 0,5 j.
**Risque** : très faible.
**Dépendance** : phases 0-7 mergées.

### 8.1 Étapes

1. **Supprimer `ProductCard`** si vraiment plus utilisé (re-vérifier grep).
2. Documenter le module `composition` :
   - README dans `apps/web/src/components/kit/` qui pointe vers ce dossier de plan.
   - Storybook stories (si Storybook configuré).
3. Handoff DA pour les images contextuelles à terme.
4. Final commit : `chore(composition): cleanup ProductCard, README handoff`.

### 8.2 Fichiers touchés

- `apps/web/src/components/commerce/ProductCard.tsx` (suppression)
- `apps/web/src/components/commerce/ProductCard.test.tsx` (suppression si tests existaient)
- `apps/web/src/components/kit/README.md` (nouveau)

### 8.3 Critères de done

- `grep ProductCard apps/web/src` retourne uniquement les imports devenus références mortes.
- Suppression compilée sans erreur.
- README handoff lisible et complet.

---

## Phase 9 — Backlog (P4)

| ID | Item | Effort |
|---|---|---|
| 9.1 | Scroll-snap horizontal mobile (A/B) | 1 j |
| 9.2 | Tooltip étymologie / origine japonaise | 0,5 j |
| 9.3 | Visual regression Playwright sur composition | 0,5 j |
| 9.4 | Storybook stories pour `CompositionCard` × 4 variants | 0,5 j |
| 9.5 | Migration vers Sanity CMS (hors scope) | 3 j |

---

## Vue d'ensemble — Gantt simplifié

```
Semaine 1
  Lundi      Phase 0 (0,5 j) + Phase 1 (0,5 j)
  Mardi      Phase 2 (1 j)
  Mercredi   Phase 3 (1 j)
  Jeudi      Phase 4 (0,5 j) + démarrage Phase 5 (DA brief)
  Vendredi   Phase 5 intégration

Semaine 2
  Lundi-Mardi  Phase 6 (admin éditeur, 2 j)
  Mercredi     Phase 7 (E2E + a11y, 1 j)
  Jeudi        Phase 8 (cleanup, 0,5 j) + buffer
  Vendredi     Buffer / DA refresh / smoke prod
```

**Total** : ~8 j homme effectifs + 1 j buffer.

## Indicateurs de progression

À mettre à jour dans `README.md` à chaque phase mergée :

```
| Phase | Statut       | Mergé main  | Déployé prod |
|-------|--------------|-------------|---------------|
| 0     | À faire      | -           | -             |
| 1     | À faire      | -           | -             |
| ...
```
