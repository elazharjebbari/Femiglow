# 08 — Plan d'action par phases

Découpage en 7 phases ordonnées. Chaque phase a son objectif, ses
fichiers touchés, sa stratégie test-first, et ses critères de done.

## Phase 0 — Quick wins Pricing Kolenda (P0)

**Durée** : 0,5 j. **Risque** : très faible.

### 0.1 Objectif

Appliquer les 4 leviers Pricing Kolenda manqués :
- (a) **Valeur séparée** (Pricing §15) : `valueBreakdown` dans `hero`
- (b) **« Économie 191 MAD »** terracotta (Pricing §6 + Color §1)
- (c) **Reframing valeur d'usage** « ≈ 1,5 MAD/manucure · 1 200 MAD/an salon » (Pricing §7-8)
- (d) **Hiérarchie taille forte** : prix `199` en `text-5xl`, barré `text-lg` (60 % du courant)

### 0.2 Étapes

1. Test-first : `lib/kit/pack/savings.test.ts` (~5 cas) + `lib/kit/pack/per-usage.test.ts` (~5 cas)
2. Implémenter `computePackSavings` + `buildPerUsageHint`
3. Étendre `ProductFeedHero` type : `valueBreakdown?`, `perUsageHint?`
4. Étendre `buildKitProductFeed` pour seed les nouveaux champs
5. Implémenter `ValueBreakdownList.tsx` + tests (~5 cas)
6. Implémenter `PriceBlock.tsx` (extrait du JSX inline de `ProductFeedSection`) + tests (~12 cas)
7. Refactor `ProductFeedSection` pour utiliser `<PriceBlock>`
8. Run vitest + typecheck + smoke `/kit`
9. Commit : `feat(pack): phase 0 — quick wins Pricing Kolenda (valeur séparée + économie + reframing)`

### 0.3 Fichiers touchés

- `apps/web/src/lib/kit/pack/savings.ts` (nouveau)
- `apps/web/src/lib/kit/pack/savings.test.ts` (nouveau)
- `apps/web/src/lib/kit/pack/per-usage.ts` (nouveau)
- `apps/web/src/lib/kit/pack/per-usage.test.ts` (nouveau)
- `apps/web/src/lib/products/feed/types.ts` (étendre)
- `apps/web/src/lib/products/feed/kit-feed.ts` (seed nouveaux champs)
- `apps/web/src/lib/products/feed/schema.ts` (étendre validation)
- `apps/web/src/lib/products/feed/pack.composition.test.ts` (nouveau)
- `apps/web/src/components/commerce/ValueBreakdownList.tsx` (nouveau)
- `apps/web/src/components/commerce/ValueBreakdownList.test.tsx` (nouveau)
- `apps/web/src/components/commerce/PriceBlock.tsx` (nouveau)
- `apps/web/src/components/commerce/PriceBlock.test.tsx` (nouveau)
- `apps/web/src/components/sections/ProductFeedSection.tsx` (refactor)

### 0.4 Gate

- `pnpm typecheck` exit 0
- `pnpm vitest run src/lib/kit/pack src/components/commerce/PriceBlock src/components/commerce/ValueBreakdownList src/components/sections/ProductFeedSection src/lib/products/feed` : 100 % vert
- Smoke `/kit` : voir `[data-testid="pack-value-breakdown"]`, `[data-testid="pack-savings-line"]`, `[data-testid="pack-per-usage"]` ; prix `199` en `text-5xl`

---

## Phase 1 — CTA refonte (P0)

**Durée** : 0,25 j. **Risque** : très faible.

### 1.1 Objectif

- (a) Label « Recevoir le pack » → **« Commander le rituel »** (Copywriting §13)
- (b) Couleur `bg-encre` → **`bg-sauge-dark`** (Color §1)
- (c) **Micro-pulse** `scale 1.02` toutes les 3,5 s (Attention §3)
- (d) Schema `ctaAccent` ('encre' | 'sauge-dark' | 'champagne-dark') + seed mock

### 1.2 Étapes

1. Étendre `ProductFeedHero` : `ctaAccent?: 'encre' | 'sauge-dark' | 'champagne-dark'`
2. Étendre `tailwind.config.ts` avec keyframe `soft-pulse` + animation `motion-safe`
3. Modifier `PriceBlock` pour appliquer la classe d'accent et l'animation
4. Seed mock : `ctaLabel = 'Commander le rituel'`, `ctaAccent = 'sauge-dark'`
5. Test : `PriceBlock` rend la bonne couleur + classe `motion-safe:animate-soft-pulse`
6. Smoke : visualiser le CTA pulse en mode `motion-safe`, OK avec `prefers-reduced-motion: reduce`
7. Commit : `feat(pack): phase 1 — CTA sauge profond + micro-pulse + label rôle`

### 1.3 Fichiers touchés

- `apps/web/src/lib/products/feed/types.ts` (extend)
- `apps/web/src/lib/products/feed/kit-feed.ts` (label + accent)
- `apps/web/tailwind.config.ts` (keyframes)
- `apps/web/src/components/commerce/PriceBlock.tsx` (apply class)
- `apps/web/src/components/commerce/PriceBlock.test.tsx` (cas accent + pulse)

### 1.4 Gate

- Tests phase 1 verts
- Smoke : CTA sauge, animation visible 3,5 s

---

## Phase 2 — Social proof libellé + position (P0)

**Durée** : 0,25 j. **Risque** : très faible.

### 2.1 Objectif

- (a) `socialProof.countLabelGeo` field optionnel
- (b) Libellé « 287 avis » → **« 287 femmes · Rabat, Casablanca, Marrakech »**
- (c) Position rapprochée : `mt-16` → `mt-8`, `py-10` → `py-8` (densité Ecommerce §14)

### 2.2 Étapes

1. Étendre `ProductFeedSocialProof` : `countLabelGeo?: string | null`
2. Seed mock `kit-feed.ts` : `countLabelGeo: '287 femmes · Rabat, Casablanca, Marrakech'`
3. Modifier `ProductFeedSection` rendu social proof : `countLabelGeo ?? '${reviewsCount} avis'`
4. Réduire les `mt-16`/`py-10` à `mt-8`/`py-8`
5. Test : snapshot avec/sans `countLabelGeo`
6. Smoke : rendu sur mobile, lisible sur 320 px viewport
7. Commit : `feat(pack): phase 2 — social proof libellé géographique + densité`

### 2.3 Fichiers touchés

- `apps/web/src/lib/products/feed/types.ts` (extend)
- `apps/web/src/lib/products/feed/kit-feed.ts` (seed)
- `apps/web/src/components/sections/ProductFeedSection.tsx` (rendu + densité)
- `apps/web/src/components/sections/ProductFeedSection.test.tsx` (cas)

### 2.4 Gate

- Tests phase 2 verts
- Smoke : libellé géo visible, social proof rapproché du CTA

---

## Phase 3 — Packshot + reveal animations (P1)

**Durée** : 1 j. **Risque** : moyen (asset DA).

### 3.1 Objectif

- (a) **Packshot 3 produits** au-dessus du bloc prix (réutilise `/products/kit-principale.svg`)
- (b) **Reveal animations** sur 4 step cards (stagger 80 ms) et 3 claims (stagger 100 ms)
- (c) Respect `prefers-reduced-motion`

### 3.2 Étapes

1. Test-first : `PackVisual.test.tsx` (~3 cas)
2. Implémenter `PackVisual.tsx` (Server) avec `/products/kit-principale.svg`
3. Brancher dans `ProductFeedSection` au-dessus de `PriceBlock`
4. Réutiliser `Reveal` existant (composition phase 4) sur :
   - `feed.steps.map((step, i) => <Reveal delay={i * 80}>...</Reveal>)`
   - `feed.claims.map((claim, i) => <Reveal delay={i * 100}>...</Reveal>)`
5. Test : snapshot avec PackVisual + Reveal wrapper
6. Test : `useReducedMotion = true` désactive les animations
7. Smoke : ouvrir `/kit`, observer le reveal au scroll vers la section
8. Commit : `feat(pack): phase 3 — packshot + reveal stagger steps/claims`

### 3.3 Fichiers touchés

- `apps/web/src/components/sections/PackVisual.tsx` (nouveau)
- `apps/web/src/components/sections/PackVisual.test.tsx` (nouveau)
- `apps/web/src/components/sections/ProductFeedSection.tsx` (intégration packshot + Reveal)

### 3.4 Gate

- Tests phase 3 verts
- Smoke : packshot visible, reveal animation lisse au scroll
- LCP `/kit` préservé ≤ 2,5 s

---

## Phase 4 — Admin éditeur singleton (P1)

**Durée** : 0,75 j. **Risque** : moyen.

### 4.1 Objectif

Éditeur `/admin/kit/pack` singleton, pattern strict identique
`KitVideoEditor` (cf. video phase 6).

### 4.2 Sous-phases

- **4.A** Store + resolver + types + schemas (`lib/kit/pack/*`)
- **4.B** API routes (`/api/admin/kit/pack/{route,publish,reset}`)
- **4.C** Admin UI (`KitPackEditor` + `ValueBreakdownEditor` + `KitPackPreviewCard` + `KitPackResetDialog`)
- **4.D** Page Next.js `/admin/kit/pack/page.tsx` + bind public via `ProductFeedSectionKitBound`

### 4.3 Étapes (mirroir composition phase 5)

Cf. doc 04 (Backend design) et doc 06 (Admin UI/UX design).

### 4.4 Fichiers touchés

- ~12 nouveaux fichiers (cf. doc 04 + doc 06)
- `AdminShell` : ajout entrée nav `kit-pack`
- `/kit/page.tsx` : remplace `<ProductFeedSectionBound>` par `<ProductFeedSectionKitBound>`

### 4.5 Gate

- Tests phase 4 : ~30 nouveaux cas, 100 % vert
- Smoke admin : éditer kicker → save → publish → vérifier sur `/kit`
- Reset workflow validé

---

## Phase 5 — E2E Playwright + axe (P1)

**Durée** : 0,5 j. **Risque** : faible.

### 5.1 Objectif

Specs Playwright `@pack-*` (render, interaction, a11y, responsive, admin) +
tracking events `pack_section_view`, `pack_economy_view`,
`pack_social_proof_view`, `pack_cta_click`.

### 5.2 Étapes

1. Écrire `e2e/pack-section.spec.ts` (4 describe, ~12 cas) — cf. doc 07 §6
2. Écrire `e2e/admin-pack.spec.ts` (~5 cas)
3. Implémenter `PackSectionTracker` (Client) qui émet les 4 events
4. Brancher dans `ProductFeedSection`
5. Schemas tracking : déclarer les 4 events
6. Run local + CI
7. Commit : `test(pack): phase 5 — E2E Playwright + a11y axe + tracking`

### 5.3 Fichiers touchés

- `apps/web/e2e/pack-section.spec.ts` (nouveau)
- `apps/web/e2e/admin-pack.spec.ts` (nouveau)
- `apps/web/src/components/sections/PackSectionTracker.tsx` (nouveau)
- `apps/web/src/components/sections/PackSectionTracker.test.tsx` (nouveau)
- `apps/web/src/lib/tracking/schemas.ts` (4 events ajoutés)
- `apps/web/src/components/sections/ProductFeedSection.tsx` (intègre tracker)

### 5.4 Gate

- 100 % vert sur 3 runs consécutifs
- 0 violation axe sur `#product-feed` et `/admin/kit/pack`

---

## Phase 6 — Handoff README + cleanup (P2)

**Durée** : 0,25 j. **Risque** : très faible.

### 6.1 Objectif

Mettre à jour `components/kit/README.md` avec la section pack refondue.
Vérifier l'absence de fichier orphelin.

### 6.2 Étapes

1. Étendre `apps/web/src/components/kit/README.md` (section pack)
2. Vérifier les imports orphelins (`tsc --noEmit` + ESLint)
3. Run lint + build prod
4. Commit : `chore(pack): phase 6 — README handoff + cleanup`

### 6.3 Fichiers touchés

- `apps/web/src/components/kit/README.md` (modifié)

### 6.4 Gate

- README à jour
- `pnpm lint` exit 0
- `pnpm typecheck` exit 0
- `pnpm build` exit 0

---

## Vue d'ensemble — Gantt simplifié

```
Semaine 1
  Lundi      Phase 0 (½j) + Phase 1 démarrage (¼j)
  Mardi      Phase 1 fin + Phase 2 (¼j)
  Mercredi   Phase 3 (1j, packshot + reveal)
  Jeudi      Phase 4 (¾j, admin éditeur)
  Vendredi   Phase 5 (½j, E2E) + Phase 6 (¼j, handoff)
```

**Total** : ~3,5 j-h effectifs sur 1 semaine.

## Indicateurs de progression

Tableau à maintenir dans `docs/pack-section-optim-2026-05/README.md`
(à ajouter à la livraison Phase 0) :

```
| Phase | Statut       | Mergé master | Déployé prod |
|-------|--------------|--------------|--------------|
| 0     | À faire      | -            | -            |
| 1     | À faire      | -            | -            |
…
```

## Anti-patterns dans l'exécution

- ❌ Sauter test-first pour gagner du temps → gate au commit, refusé
- ❌ Mélanger Phase 0 + 1 dans un commit → rollback impossible
- ❌ Publier en prod sans cycle Save→Publish→Reset validé
- ❌ Casser `assertValidProductFeed` (Zod schema)
- ❌ Casser le feed XML Merchant (`merchant.test.ts`)
- ❌ Pousser sur `master` sans `pnpm install --frozen-lockfile` réussi en local
