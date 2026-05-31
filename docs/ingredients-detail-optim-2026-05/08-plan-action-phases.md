# 08 — Plan d'action par phases

Découpage en 8 phases ordonnées. Chaque phase a son objectif, ses fichiers
touchés, sa stratégie test-first, et ses critères de done (gates).

## Phase 0 — Quick wins Kolenda (P0)

**Durée** : 0,5 j. **Risque** : très faible.

### 0.1 Objectif

Trois corrections immédiates conformes Kolenda sans toucher schema/data :

- (a) **Lien retour pack** : créer `PostCtaLink` réutilisable, brancher sous chaque sous-produit.
- (b) **Lignes alternées** : `bg-creme` / `bg-creme-warm/40` dans `IngredientsTable` actuel.
- (c) **Tracking event `composition_post_cta_click`** déclaré dans `tracking/schemas.ts`.

### 0.2 Étapes

1. Test-first : `PostCtaLink.test.tsx` (~6 cas, idem `VideoPostCta`).
2. Implémenter `PostCtaLink` (réutilise pattern `VideoPostCta`).
3. Brancher dans `IngredientsDetails.tsx` sous chaque `<figure>`.
4. Lignes alternées via `<tbody>` mapping `i % 2`.
5. Schema tracking : ajouter `composition_post_cta_click` event.
6. Run vitest + typecheck + smoke `/kit`.
7. Commit : `feat(composition): phase 0 — post-CTA + lignes alternées Kolenda`.

### 0.3 Fichiers touchés

- `apps/web/src/components/commerce/PostCtaLink.tsx` (nouveau)
- `apps/web/src/components/commerce/PostCtaLink.test.tsx` (nouveau)
- `apps/web/src/components/sections/IngredientsDetails.tsx` (modifié)
- `apps/web/src/components/commerce/IngredientsTable.tsx` (modifié : lignes alternées)
- `apps/web/src/lib/tracking/schemas.ts` (modifié : event ajouté)

### 0.4 Gate

- `pnpm typecheck` exit 0
- `pnpm vitest run src/components/commerce/PostCtaLink src/components/commerce/IngredientsTable src/components/sections/IngredientsDetails` : 100 % vert
- Smoke `/kit` : `<a data-testid="composition-post-cta-1-paste">` cliquable, scroll vers `#commander-femiglow`

---

## Phase 1 — Schema étendu (P0)

**Durée** : 0,5 j. **Risque** : faible.

### 1.1 Objectif

Ajouter `narrative`, `usageHint`, `inciDefinition` au schema, enrichir le
mock, créer le helper `sortByConcentrationDesc`.

### 1.2 Étapes

1. Test-first : `product.composition.test.ts` (~15 cas, étend tests existants).
2. Étendre `ingredientDetailedSchema` avec `inciDefinition.optional().max(200)`.
3. Étendre `subProductSchema` avec `narrative` + `usageHint` optionnels.
4. Enrichir `data/mock/kit.ts` :
   - 15 `inciDefinition` (5 par sous-produit en moyenne)
   - 3 `narrative` (1 par sous-produit)
   - 3 `usageHint` (1 par sous-produit)
5. Implémenter `lib/kit/composition/sort.ts` + tests (~5 cas).
6. Run vitest + typecheck.
7. Commit : `feat(composition): phase 1 — schema étendu (narrative, usageHint, inciDefinition)`.

### 1.3 Fichiers touchés

- `apps/web/src/lib/schemas/product.ts` (modifié)
- `apps/web/src/lib/schemas/product.composition.test.ts` (créé)
- `apps/web/src/data/mock/kit.ts` (modifié)
- `apps/web/src/lib/kit/composition/sort.ts` (créé)
- `apps/web/src/lib/kit/composition/sort.test.ts` (créé)

### 1.4 Gate

- `pnpm typecheck` exit 0
- `pnpm vitest run src/lib/schemas src/lib/kit/composition` : 100 % vert
- `mockKitPageContent` parse sans erreur avec extensions
- Rétro-compat : un `SubProduct` sans extensions reste valide

---

## Phase 2 — IngredientCard mobile (P0)

**Durée** : 0,75 j. **Risque** : moyen.

### 2.1 Objectif

Refonte responsive : sur mobile, remplacer le tableau par des cards
verticales `IngredientCard`. Desktop : tableau préservé.

### 2.2 Étapes

1. Test-first : `IngredientCard.test.tsx` (~10 cas).
2. Implémenter `IngredientCard` (mobile-first, accent color).
3. Test-first : `ResponsiveIngredientList.test.tsx` (~6 cas).
4. Implémenter `ResponsiveIngredientList` (split mobile/desktop).
5. Refactor `IngredientsTable` : accepte `ingredients` au lieu de `subProduct`.
6. Brancher dans `SubProductBlock` (Phase 2.b).
7. **Phase 2.b** — `SubProductBlock` (~10 cas tests) : accordéon + summary + NarrativeIntro slot.
8. Brancher dans `IngredientsDetails` : remplace boucle `figure` par `<SubProductBlock>`.
9. Run vitest + typecheck + smoke mobile (375×812).
10. Commit : `feat(composition): phase 2 — IngredientCard mobile + SubProductBlock`.

### 2.3 Fichiers touchés

- `components/commerce/IngredientCard.tsx` (créé)
- `components/commerce/IngredientCard.test.tsx` (créé)
- `components/commerce/ResponsiveIngredientList.tsx` (créé)
- `components/commerce/ResponsiveIngredientList.test.tsx` (créé)
- `components/commerce/SubProductBlock.tsx` (créé)
- `components/commerce/SubProductBlock.test.tsx` (créé)
- `components/commerce/IngredientsTable.tsx` (refactor signature)
- `components/commerce/IngredientsTable.test.tsx` (refactor tests)
- `components/sections/IngredientsDetails.tsx` (modifié)
- `components/sections/IngredientsDetails.test.tsx` (créé ou étendu)

### 2.4 Gate

- Tests phase 2 : 100 % vert (~32 nouveaux cas + refactor existants)
- Smoke mobile 375×812 : aucun scroll horizontal sur la section
- Smoke desktop 1280×800 : tableau 5 colonnes complet
- Lighthouse `/kit` mobile ≥ 92 (préservé)

---

## Phase 3 — InciTooltip (P0)

**Durée** : 0,5 j. **Risque** : faible.

### 3.1 Objectif

Tooltip popover sur le bouton ⓘ à côté du nom INCI, qui affiche
`inciDefinition`. Conforme ARIA tooltip pattern.

### 3.2 Étapes

1. Test-first : `InciTooltip.test.tsx` (~8 cas).
2. Implémenter `InciTooltip.tsx` (Popover HTML5 + fallback `<details>`).
3. Brancher dans `IngredientCard` + `IngredientsTable`.
4. Schema tracking : `composition_inci_tooltip_open` event.
5. Run vitest + typecheck + smoke.
6. Commit : `feat(composition): phase 3 — InciTooltip + tracking`.

### 3.3 Fichiers touchés

- `components/commerce/InciTooltip.tsx` (créé)
- `components/commerce/InciTooltip.test.tsx` (créé)
- `components/commerce/IngredientCard.tsx` (intègre tooltip)
- `components/commerce/IngredientsTable.tsx` (intègre tooltip)
- `lib/tracking/schemas.ts` (event ajouté)

### 3.4 Gate

- Tests phase 3 : 100 % vert
- Smoke : click ⓘ → popover s'ouvre avec définition
- Smoke : Esc ferme le popover
- Axe : 0 violation sur le popover

---

## Phase 4 — Lien pack + tracking enrichi (P1)

**Durée** : 0,25 j. **Risque** : très faible.

### 4.1 Objectif

Tracking events `composition_narrative_view` (IntersectionObserver) +
`composition_accordion_open`. Composant `NarrativeIntro` finalisé.

### 4.2 Étapes

1. Test-first : `NarrativeIntro.test.tsx` (~5 cas).
2. Implémenter `NarrativeIntro` (IntersectionObserver + emit).
3. Modifier `SubProductBlock` : émit `composition_accordion_open` au `onToggle`.
4. Schema tracking : 2 events ajoutés.
5. Run vitest + smoke + DevTools Network pour vérifier émissions.
6. Commit : `feat(composition): phase 4 — NarrativeIntro + tracking accordion/narrative`.

### 4.3 Fichiers touchés

- `components/commerce/NarrativeIntro.tsx` (créé)
- `components/commerce/NarrativeIntro.test.tsx` (créé)
- `components/commerce/SubProductBlock.tsx` (ajout emit)
- `lib/tracking/schemas.ts` (events ajoutés)

### 4.4 Gate

- Tests phase 4 : 100 % vert
- 4 events tracking déclarés et émis correctement (vérifier DevTools)

---

## Phase 5 — Admin éditeur composition (P1)

**Durée** : 0,75 j. **Risque** : moyen.

### 5.1 Objectif

Éditeur singleton par sous-produit, identique au pattern `KitVideoEditor`.

### 5.2 Sous-phases

- **5.A** Store + resolver + types (`lib/kit/composition/{store,resolver,types}.ts`)
- **5.B** API routes (`/api/admin/kit/composition/[id]/{route,publish,reset}`)
- **5.C** Admin UI (`KitCompositionEditor` + sous-forms)
- **5.D** Page Next.js `/admin/kit/composition/[id]` + bind public

### 5.3 Étapes (mirroir video phase 6)

Cf. doc 04 (Backend design) et doc 06 (Admin UI/UX design).

### 5.4 Fichiers touchés

- ~12 nouveaux fichiers (cf. doc 04 + doc 06)
- AdminShell : ajout entrée nav `kit-composition`
- `/kit/page.tsx` : remplace `<IngredientsDetailsBound>` par version qui appelle le resolver

### 5.5 Gate

- Tests phase 5 : ~40 nouveaux cas, 100 % vert
- Smoke admin : éditer Paste → save → publish → vérifier sur `/kit`
- Reset workflow validé

---

## Phase 6 — E2E Playwright + axe (P1)

**Durée** : 0,5 j. **Risque** : faible.

### 6.1 Objectif

Specs Playwright `@composition-*` (render, interaction, a11y, responsive,
admin). Bloque la régression sur les phases 0-5.

### 6.2 Étapes

1. Écrire `e2e/composition-detail.spec.ts` (4 describe, ~15 cas) (cf. doc 07).
2. Écrire `e2e/admin-composition-detail.spec.ts` (5 cas).
3. Configurer fixtures auth admin (réutilise SEO).
4. Run local + CI.
5. Documenter flakes éventuels.
6. Commit : `test(composition): phase 6 — E2E Playwright + a11y axe`.

### 6.3 Fichiers touchés

- `apps/web/e2e/composition-detail.spec.ts` (créé)
- `apps/web/e2e/admin-composition-detail.spec.ts` (créé)

### 6.4 Gate

- 100 % vert sur 3 runs consécutifs
- 0 violation axe sur `/kit#ingredients-details` et `/admin/kit/composition/[id]`

---

## Phase 7 — README handoff + cleanup (P2)

**Durée** : 0,25 j. **Risque** : très faible.

### 7.1 Objectif

Mettre à jour `components/kit/README.md` avec la section composition refondue.
Vérifier l'absence de fichier orphelin (legacy `IngredientsTable` API ?).

### 7.2 Étapes

1. Mettre à jour `apps/web/src/components/kit/README.md` (section ingredients).
2. Vérifier que `IngredientsTable` n'est plus appelé avec l'ancienne signature.
3. Vérifier les imports orphelins (`tsc --noEmit` + ESLint).
4. Run lint + build prod.
5. Commit : `chore(composition): phase 7 — README handoff + cleanup`.

### 7.3 Fichiers touchés

- `apps/web/src/components/kit/README.md` (modifié)

### 7.4 Gate

- README à jour
- `pnpm lint` : 0 nouvelle erreur
- `pnpm typecheck` : exit 0
- `pnpm build` : exit 0

---

## Vue d'ensemble — Gantt simplifié

```
Semaine 1
  Lundi      Phase 0 (½j) + Phase 1 démarrage (½j)
  Mardi      Phase 1 fin + Phase 2 démarrage
  Mercredi   Phase 2 (suite, complexe responsive)
  Jeudi      Phase 2 fin + Phase 3 (½j)
  Vendredi   Phase 4 (¼j) + Phase 5 démarrage

Semaine 2
  Lundi      Phase 5 (suite)
  Mardi      Phase 5 fin (½j) + Phase 6 démarrage (½j)
  Mercredi   Phase 6 fin + Phase 7 (¼j) + buffer
  Jeudi      Buffer / smoke prod / déploiement
  Vendredi   Monitoring KPIs J+7
```

**Total** : ~3,5 j-homme effectifs.

## Indicateurs de progression

Tableau à maintenir dans `docs/ingredients-detail-optim-2026-05/README.md` (à
ajouter à la livraison Phase 0) :

```
| Phase | Statut       | Mergé master | Déployé prod |
|-------|--------------|--------------|--------------|
| 0     | ✅ Done       | abc1234      | 2026-05-23   |
| 1     | 🟡 En cours   | -            | -            |
| 2     | 🔴 À faire    | -            | -            |
…
```

## Anti-patterns dans l'exécution

- ❌ Sauter la phase de test-first pour gagner du temps → impossible, gate au commit
- ❌ Mixer phase 1 et phase 2 dans un commit → rétro-compat impossible à valider
- ❌ Publier en prod sans avoir validé un cycle Save→Publish→Reset complet
- ❌ Refactor `IngredientsTable` sans mettre à jour ses tests existants
- ❌ Pousser sur `master` sans `pnpm install --frozen-lockfile` réussi en local
