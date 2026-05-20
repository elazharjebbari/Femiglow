# 08 — Plan d'action — 5 phases incrémentales

> Effort total **~1,25 j-h** (1 j 2 h). Chaque phase = 1 commit atomique
> rétro-compatible et déployable indépendamment. Aucun verrou inter-phase
> hors G0 (les phases G1→G4 lisent toutes les nouveaux champs G0).
>
> Phase **G5** (admin override) est **optionnelle** — décision GO/NO-GO
> à J+30 selon KPIs.

## Vue d'ensemble

| Phase | Durée | Livrable | Branch | Gate |
|---|---|---|---|---|
| G0 | ¼ j | Schema étendu + builder enrichi | `feat/steps-phase-0-schema` | Tests rétro-compat verts |
| G1 | ¼ j | Header EN TOUT + durée par step + outcome step 4 | `feat/steps-phase-1-ui` | Smoke /kit OK |
| G2 | ¼ j | Connecteur visuel (timeline) | `feat/steps-phase-2-connector` | Responsive 3 viewports |
| G3 | ¼ j | Icônes SVG + reveal stagger Framer Motion | `feat/steps-phase-3-motion` | prefers-reduced-motion OK |
| G4 | ¼ j | PostCtaLink + 3 events tracking + tests + handoff | `feat/steps-phase-4-tracking` | E2E `@steps-*` 0 flake |
| G5 | ½ j | Admin éditeur singleton (optionnel J+30) | `feat/steps-phase-5-admin` | Cycle Save/Publish/Reset OK |

---

## Phase G0 — Schema + builder enrichi (¼ j)

### G0.1 Étapes

1. **Test-first schemas** : créer `schema.test.ts` (cas `duration` /
   `isResult` / `icon` / `stepsHeader` / `stepsPostCta`).
2. Étendre `ProductFeedStep` dans `types.ts`.
3. Ajouter `ProductFeedStepsHeader` + `ProductFeedStepsPostCta`.
4. Étendre `productFeedSchema` Zod.
5. Enrichir `buildSteps()` (4 steps avec duration/icon/isResult).
6. Ajouter `buildStepsHeader()` + `buildStepsPostCta()` dans
   `buildKitProductFeed()`.
7. Helpers purs : `lib/kit/steps/total-duration.ts`,
   `lib/kit/steps/pick-result.ts`.
8. Tests purs vitest des helpers (~8 cas).

### G0.2 Verify

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run src/lib/products/feed src/lib/kit/steps
```

Tous existants (90 tests product-feed) restent verts → rétro-compat OK.

### G0.3 Commit

```bash
git commit -m "feat(steps): phase 0 — schema étendu (duration, icon, isResult, header, postCta)"
```

### G0.4 Rollback
Revert sans impact runtime (les champs sont optionnels, les composants
public n'utilisent pas encore).

---

## Phase G1 — UI durée + outcome step 4 (¼ j)

### G1.1 Étapes

1. **Test-first** `StepsHeader.test.tsx` (~3 cas).
2. Créer `StepsHeader.tsx` (Server).
3. **Test-first** refonte `StepCard.test.tsx` (~6 cas).
4. Créer `StepCard.tsx` (Server) — duration badge + isResult ring +
   italique outcome.
5. Refactor `ProductFeedSection.tsx` : remplacer la grille inline par
   `<StepsHeader>` + `<ol>` avec `<StepCard>`.
6. Update `ProductFeedSection.test.tsx` (mock pas nécessaire car
   StepCard est Server).

### G1.2 Verify

```bash
pnpm --filter web exec vitest run src/components/sections/StepsHeader src/components/sections/StepCard src/components/sections/ProductFeedSection
```

### G1.3 Smoke navigateur

`/kit` mobile + desktop : header « EN TOUT / 5 minutes » visible, 4
cartes avec badge durée, step 4 avec anneau doublé + badge RÉSULTAT +
description italique.

### G1.4 Commit

```bash
git commit -m "feat(steps): phase 1 — header EN TOUT + durée par step + outcome step 4"
```

---

## Phase G2 — Connecteur visuel (¼ j)

### G2.1 Étapes

1. **Test-first** `StepsConnector.test.tsx` (~3 cas).
2. Créer `StepsConnector.tsx` (Server, 2 spans `aria-hidden`).
3. Brancher dans `<ol>` du parent (relative + absolute positioning).
4. Tests responsive : ligne desktop visible `lg+`, timeline mobile
   visible `< sm`.

### G2.2 Verify visuel

- Mobile 375 : ligne verticale gauche à 24 px (left-6), height plein
- Desktop 1280 : ligne pointillée horizontale à top-6 (centre des
  pastilles 48 px de haut)
- Tablet 768 : aucun connecteur (la grille 2 cols casserait l'alignement)

### G2.3 Commit

```bash
git commit -m "feat(steps): phase 2 — connecteur visuel timeline (mobile vertical, desktop pointillé)"
```

---

## Phase G3 — Icônes SVG + reveal stagger (¼ j)

### G3.1 Étapes

1. **Test-first** `StepIcon.test.tsx` (~5 cas — 4 icônes + className).
2. Créer `StepIcon.tsx` (Server, 4 SVG inline stroke 1.5).
3. Brancher dans `StepCard` au-dessus de la pastille.
4. Créer `StepsTimeline.tsx` (Client) qui wrap la grille avec
   `LazyMotion` + `m.div` stagger.
5. **Test-first** `StepsTimeline.test.tsx` (~6 cas y compris IO mocks).
6. Remplacer `<ol>` direct dans `ProductFeedSection.tsx` par
   `<StepsTimeline>`.
7. `useReducedMotion` désactive le wrapper `m.div`.

### G3.2 Verify

```bash
# prefers-reduced-motion ON dans DevTools → aucune animation visible
# OFF → reveal stagger ~80 ms par step au scroll
```

### G3.3 Commit

```bash
git commit -m "feat(steps): phase 3 — icônes SVG par step + reveal stagger Framer Motion"
```

---

## Phase G4 — PostCtaLink + tracking + E2E (¼ j)

### G4.1 Étapes

1. **Test-first** `StepsPostCtaLink.test.tsx` (~4 cas).
2. Créer `StepsPostCtaLink.tsx` (Client) — émet `pack_steps_cta_click`.
3. Compléter `StepsTimeline.tsx` :
   - IO `pack_steps_view` au seuil 0.4 sur le wrapper section.
   - IO `pack_steps_complete_view` au seuil 0.5 sur step `isResult`.
4. Compléter `StepsTimeline.test.tsx` avec IO mock custom.
5. Créer `e2e/steps-timeline.spec.ts` :
   - `@steps-render` (4 cas)
   - `@steps-interaction` (2 cas)
   - `@steps-responsive` (2 cas)
   - `@steps-a11y` (1 cas axe)
6. Run `playwright test --grep '@steps-'` × 3 → 0 flake.

### G4.2 Quality gates finaux

```bash
pnpm --filter web exec tsc --noEmit       # 0 erreur sur fichiers G0-G4
pnpm --filter web exec vitest run         # tous verts
pnpm --filter web exec playwright test --grep '@steps-'  # 0 flake
pnpm --filter web build                   # exit 0
```

### G4.3 Commit + README handoff

```bash
git commit -m "feat(steps): phase 4 — PostCtaLink + tracking IO + E2E Playwright"
```

Mettre à jour `components/sections/README.md` avec une nouvelle sous-
section « Section steps-timeline §4.7 ».

---

## Phase G5 — Admin override singleton (½ j, optionnel)

Si J+30 montre que l'override est nécessaire :

### G5.A Store + resolver + types + schemas (¼ j)
- `lib/kit/steps/types.ts`
- `lib/kit/steps/store.ts` (memoryStore)
- `lib/kit/steps/resolver.ts`
- `lib/kit/steps/schemas.ts` (Zod kitStepsOverrideUpsertSchema)
- Tests 20+ cas

### G5.B API routes
- `GET / PATCH /api/admin/kit/steps`
- `POST /api/admin/kit/steps/publish`
- `POST /api/admin/kit/steps/reset`
- Audit `kit_steps.update/publish/reset`
- Tests MSW

### G5.C Admin UI
- `KitStepsEditor.tsx`
- `StepEditorRow.tsx`
- `KitStepsPreviewCard.tsx`
- `KitStepsResetDialog.tsx`
- AdminShell entry `kit-steps`

### G5.D Bind public
- `ProductFeedSectionBound` lit aussi `resolveKitSteps(feed)` et merge.

---

## Anti-patterns à éviter

| Anti-pattern | Risque | Mitigation |
|---|---|---|
| Refondre la copy en même temps que la structure | Mélange diff impossible | Conserver textuel mock G0 inchangé, ne toucher que les nouveaux champs |
| Ajouter dépendance UI (lucide-icons, etc.) | +kB bundle | SVG inline maison (cohérent claims) |
| Animer toutes les cartes en parallèle | Distraction | Stagger 0.08 s, ratio scaled |
| Bouton « Démarrer » primary criard | Brise voix lente | PostCtaLink = lien éditorial chuchoté (style identique composition) |
| Mesurer 10 events | Pollution analytics | 3 events suffisent (view / complete / click) |
| Reset bouton sans magic word | Risque erreur admin | Magic word `RESET-STEPS` + modale |

## Sequence des commits attendue

```
feat(steps): phase 0 — schema étendu (duration, icon, isResult, header, postCta)
feat(steps): phase 1 — header EN TOUT + durée par step + outcome step 4
feat(steps): phase 2 — connecteur visuel timeline (mobile vertical, desktop pointillé)
feat(steps): phase 3 — icônes SVG par step + reveal stagger Framer Motion
feat(steps): phase 4 — PostCtaLink + tracking IO + E2E Playwright
docs(steps): handoff README sections — timeline §4.7
[optionnel G5 — feat/test/docs]
```
