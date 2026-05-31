# 09 — Runbook d'exécution

Procédure pas-à-pas pour livrer la refonte. À suivre **dans l'ordre**.
Chaque phase a son **rollback** documenté et son **smoke test** avant commit.

> Référence du plan : `08-plan-action-phases.md`.
> Référence Kolenda : `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §4.7.

## 0. Pré-requis

```bash
# Sanity environnement
node --version         # ≥ 20.x
pnpm --version         # ≥ 9.15.x
git status             # working tree clean
git pull origin master

pnpm install --frozen-lockfile
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run --reporter=verbose 2>&1 | tail -5
# Expected: tous verts (hors flakes pré-existants documentés)

pnpm --filter web build
# Expected: exit 0
```

Si check échoue → **stop, investiguer**.

### 0.1 Pré-lecture

Avant la première ligne :
1. `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §4.7
2. `docs/steps-grid-optim-2026-05/01-context-analyse.md`
3. `apps/web/src/components/sections/ProductFeedSection.tsx` (état actuel)
4. `apps/web/src/lib/products/feed/kit-feed.ts` (builder steps)

### 0.2 Conventions de branches

| Phase | Branche | Commit prefix |
|---|---|---|
| G0 | `feat/steps-phase-0-schema` | `feat(steps):` |
| G1 | `feat/steps-phase-1-ui` | `feat(steps):` |
| G2 | `feat/steps-phase-2-connector` | `feat(steps):` |
| G3 | `feat/steps-phase-3-motion` | `feat(steps):` |
| G4 | `feat/steps-phase-4-tracking` | `feat(steps):` puis `test(steps):` |
| G5 | `feat/steps-phase-5-admin` | `feat(steps):` |

---

## 1. Phase G0 — Schema + builder enrichi (¼ j-h)

### 1.1 Setup

```bash
git checkout master && git pull
git checkout -b feat/steps-phase-0-schema
```

### 1.2 Étapes

#### 1.2.1 Test-first schemas
Créer `apps/web/src/lib/products/feed/schema.test.ts` (compléter avec
cas duration/icon/isResult/stepsHeader/stepsPostCta).

```bash
pnpm --filter web exec vitest run src/lib/products/feed/schema.test.ts
# ✗ Cas nouveaux échouent (schemas pas encore étendus)
```

#### 1.2.2 Étendre types + Zod
- `apps/web/src/lib/products/feed/types.ts` :
  + `duration?`, `isResult?`, `icon?` sur `ProductFeedStep`
  + `ProductFeedStepIcon = 'buffer' | 'drop' | 'sparkle' | 'mirror'`
  + `ProductFeedStepsHeader`, `ProductFeedStepsPostCta`
  + `stepsHeader?`, `stepsPostCta?` sur `ProductFeed`
- `apps/web/src/lib/products/feed/schema.ts` :
  + `stepIconSchema`, `stepsHeaderSchema`, `stepsPostCtaSchema`
  + Étendre `stepSchema` (champs `.optional()`)
  + Étendre `productFeedSchema`

#### 1.2.3 Enrichir builder

`apps/web/src/lib/products/feed/kit-feed.ts` :
- Étendre `buildSteps()` avec `duration / icon / isResult` pour les 4 steps
  (voir doc 03 §7)
- Ajouter `buildStepsHeader()` et `buildStepsPostCta()`
- Brancher dans l'objet `feed` final

#### 1.2.4 Helpers purs
Créer `apps/web/src/lib/kit/steps/total-duration.ts` + test.
Créer `apps/web/src/lib/kit/steps/pick-result.ts` + test.

#### 1.2.5 Verify

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run src/lib/products/feed src/lib/kit/steps
```

Tous les 90 tests product-feed existants + 30+ nouveaux verts.

#### 1.2.6 Commit

```bash
git add apps/web/src/lib/products/feed/types.ts \
        apps/web/src/lib/products/feed/schema.ts \
        apps/web/src/lib/products/feed/schema.test.ts \
        apps/web/src/lib/products/feed/kit-feed.ts \
        apps/web/src/lib/products/feed/kit-feed.test.ts \
        apps/web/src/lib/kit/steps/
git commit -m "feat(steps): phase 0 — schema étendu (duration, icon, isResult, header, postCta)"
git push origin feat/steps-phase-0-schema
```

### 1.3 Rollback G0
`git revert <commit>`. Aucun side-effect runtime — les champs sont
optionnels et personne ne les lit encore.

---

## 2. Phase G1 — UI durée + outcome step 4 (¼ j-h)

### 2.1 Setup

```bash
git checkout -b feat/steps-phase-1-ui
```

### 2.2 Étapes

#### 2.2.1 Test-first
`apps/web/src/components/sections/StepsHeader.test.tsx` (~3 cas).
`apps/web/src/components/sections/StepCard.test.tsx` (~6 cas).

#### 2.2.2 Implémenter

- `StepsHeader.tsx` : voir doc 05 §3
- `StepCard.tsx` : voir doc 05 §4 (sans StepIcon pour G1, ajouté en G3)

#### 2.2.3 Brancher

`ProductFeedSection.tsx` :
```diff
- <ol role="list" aria-label="Les quatre gestes du rituel" className="mt-20 grid …">
-   {feed.steps.map((step) => <FeedStepCard key={step.step} step={step} />)}
- </ol>
+ {feed.stepsHeader && <StepsHeader header={feed.stepsHeader} />}
+ <ol role="list" aria-label="Les quatre gestes du rituel" className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
+   {feed.steps.map((step) => (
+     <li key={step.step} data-step={step.step}>
+       <StepCard step={step} />
+     </li>
+   ))}
+ </ol>
```

Supprimer la fonction inline `FeedStepCard` (devenue obsolète).
Garder `FeedClaimItem` / `FeedClaimIcon`.

#### 2.2.4 Verify

```bash
pnpm --filter web exec vitest run src/components/sections
pnpm --filter web exec tsc --noEmit
```

#### 2.2.5 Smoke navigateur

```bash
pnpm --filter web dev
# Visiter http://localhost:3001/kit
# - Bloc « EN TOUT / 5 minutes » au-dessus de la grille
# - Chaque carte affiche son badge « · 30 s / · 1 min / · 2 min / · 1 min »
# - Step 4 : anneau doublé, badge « RÉSULTAT », description italique
```

#### 2.2.6 Commit

```bash
git commit -m "feat(steps): phase 1 — header EN TOUT + durée par step + outcome step 4"
```

### 2.3 Rollback G1
`git revert <commit>`. La grille retombe sur l'ancien `FeedStepCard` —
non, en fait la fonction inline a été supprimée. Si rollback nécessaire,
revert restaurera l'inline. Toujours testé.

---

## 3. Phase G2 — Connecteur visuel (¼ j-h)

### 3.1 Setup

```bash
git checkout -b feat/steps-phase-2-connector
```

### 3.2 Étapes

#### 3.2.1 Test-first
`StepsConnector.test.tsx` (~3 cas).

#### 3.2.2 Implémenter
`StepsConnector.tsx` (voir doc 05 §6).

#### 3.2.3 Brancher

Dans `ProductFeedSection.tsx`, ajouter `relative` sur le `<ol>` et
`<StepsConnector aria-hidden />` en premier enfant.

#### 3.2.4 Smoke responsive

```bash
# Mobile 375  : ligne verticale visible à left-6
# Tablet 768  : aucun connecteur (grid-cols-2)
# Desktop 1280 : ligne pointillée horizontale visible à top-6
```

#### 3.2.5 Commit

```bash
git commit -m "feat(steps): phase 2 — connecteur visuel timeline (mobile vertical, desktop pointillé)"
```

### 3.3 Rollback G2
`git revert`. La grille retombe sur cartes sans connecteur (esthétique
neutre, pas de régression fonctionnelle).

---

## 4. Phase G3 — Icônes + reveal stagger (¼ j-h)

### 4.1 Étapes

#### 4.1.1 Test-first
`StepIcon.test.tsx` (~5 cas).

#### 4.1.2 Implémenter
`StepIcon.tsx` (4 SVG inline stroke 1.5 — voir doc 05 §5).

#### 4.1.3 Brancher dans StepCard
Au-dessus de la pastille, conditionnel `step.icon`.

#### 4.1.4 Créer StepsTimeline (Client)
`StepsTimeline.tsx` avec LazyMotion + m.div stagger (voir doc 05 §2).

#### 4.1.5 Remplacer ol direct dans ProductFeedSection
```diff
- {feed.stepsHeader && <StepsHeader header={feed.stepsHeader} />}
- <ol>...</ol>
+ <StepsTimeline steps={feed.steps} header={feed.stepsHeader} />
```

(`postCta` non encore branché — G4.)

#### 4.1.6 Tests
`StepsTimeline.test.tsx` (~4 cas — sans IO encore, mock useReducedMotion).

#### 4.1.7 Verify + smoke

```bash
pnpm --filter web exec vitest run src/components/sections
# /kit → reveal stagger ~80ms par carte au scroll into view
# prefers-reduced-motion ON → animations désactivées
```

#### 4.1.8 Commit

```bash
git commit -m "feat(steps): phase 3 — icônes SVG par step + reveal stagger Framer Motion"
```

### 4.3 Rollback G3
`git revert`. La grille retombe sur G2 (sans icônes, sans animation).

---

## 5. Phase G4 — PostCtaLink + tracking + E2E (¼ j-h)

### 5.1 Étapes

#### 5.1.1 StepsPostCtaLink
- `StepsPostCtaLink.test.tsx` (~4 cas)
- `StepsPostCtaLink.tsx` (voir doc 05 §7)

#### 5.1.2 Compléter StepsTimeline
- IO `pack_steps_view` au seuil 0.4 sur wrapper section
- IO `pack_steps_complete_view` au seuil 0.5 sur step result (ref sur le li)
- Brancher `<StepsPostCtaLink>` si `postCta` présent
- Compléter `StepsTimeline.test.tsx` avec IO mock custom

#### 5.1.3 E2E
Créer `apps/web/e2e/steps-timeline.spec.ts` avec 9 cas (voir doc 07 §5).

#### 5.1.4 Verify

```bash
pnpm --filter web exec vitest run
pnpm --filter web exec playwright test --grep '@steps-'  # × 3 runs, 0 flake
pnpm --filter web exec tsc --noEmit
pnpm --filter web build
```

#### 5.1.5 Smoke

```bash
# /kit : scroll → IO pack_steps_view (Network /api/track)
# Continue scroll jusqu'au step 4 → pack_steps_complete_view
# Click "Démarrer le rituel ↓" → pack_steps_cta_click + scroll vers wizard
```

#### 5.1.6 Commit

```bash
git commit -m "feat(steps): phase 4 — PostCtaLink + tracking IO + E2E Playwright"
```

### 5.2 README handoff

Mettre à jour `apps/web/src/components/sections/README.md` avec la sous-
section « Section steps-timeline §4.7 » qui documente les 6 composants,
les helpers, les events tracking et le pattern.

```bash
git commit -m "docs(steps): handoff README sections — timeline §4.7"
```

### 5.3 Rollback G4
`git revert` (×2 si docs et code séparés). La grille retombe sur G3
(timeline + icônes mais sans CTA ni tracking).

---

## 6. Déploiement (post G4)

### 6.1 Pré-déploiement

```bash
git checkout master && git pull
git merge feat/steps-phase-0-schema --no-ff
git merge feat/steps-phase-1-ui --no-ff
git merge feat/steps-phase-2-connector --no-ff
git merge feat/steps-phase-3-motion --no-ff
git merge feat/steps-phase-4-tracking --no-ff
# (ou via PR + squash sur GitHub avec rebase entre chaque)

pnpm install --frozen-lockfile
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run
pnpm --filter web build
```

### 6.2 Push

```bash
git push origin master
```

Vercel CI déclenche le build prod. Smoke prod :

```bash
curl -s https://femiglow.example.com/kit | grep -oE "(EN TOUT|5 minutes|Démarrer le rituel|RÉSULTAT)"
# Doit retourner : EN TOUT, 5 minutes, Démarrer le rituel, RÉSULTAT
```

### 6.3 Rollback prod

`git revert <merge-commit>` ou rollback Vercel UI.

---

## 7. Post-déploiement (J+7 / J+30)

### 7.1 Monitoring J+7

| KPI | Cible | Action si non atteint |
|---|---|---|
| `pack_steps_view` count | ≥ 40 % visiteurs `/kit` | Investiguer seuil IO |
| `pack_steps_complete_view` | ≥ 15 % | Vérifier ref sur step result |
| `pack_steps_cta_click` | ≥ 2 % | A/B test label CTA |
| Aucune erreur 5xx | 0 | Logs Vercel |
| Lighthouse `/kit` | ≥ 92 | Bundle delta `next build` |

### 7.2 Décision GO/NO-GO G5

À J+30, décider :
- Si admin demande à modifier durées/copy ≥ 1× par mois → livrer G5
- Sinon, rester sur mock builder (édition git)

---

## 8. Anti-patterns d'exécution

| Anti-pattern | Mitigation |
|---|---|
| Mélanger G1 + G2 dans 1 commit | 1 phase = 1 branche = 1 commit ciblé |
| Tester E2E sur dev server avec hot-reload | Toujours `pnpm build` + `pnpm start` |
| Push sans `tsc --noEmit` réussi local | Pre-commit hook bloque (déjà actif) |
| Modifier `kit-feed.ts` builder ET introduire admin G5 en parallèle | Garder builder pur isolé jusqu'à G5 |
| Sauter test-first sur StepsTimeline (IO) | Le IO mock custom est nécessaire — pas de skip |
| Mention nominale fondatrice dans copy | Sweep `grep -ri "souheila" apps/web/src/` |

## 9. Communication

### 9.1 Annonce démarrage

> « Démarrage refonte grille rituel §4.7. 5 phases, ~1,25 j-h, livraison
> cible 1 semaine. Plan : `docs/steps-grid-optim-2026-05/`. »

### 9.2 Annonce déploiement

> « Refonte timeline rituel déployée en prod. KPIs à monitorer J+7 et
> J+30. Décision GO/NO-GO admin éditeur (G5) à J+30. »

## 10. Checklist de fin

Avant merge final :

- [ ] G0→G4 commités et mergés sur master
- [ ] `tsc --noEmit` 0 erreur sur fichiers steps-*
- [ ] `vitest run` 0 fail
- [ ] `playwright test --grep '@steps-'` 0 flake × 3 runs
- [ ] `next build` exit 0, bundle delta `/kit` ≤ +3 kB gzipped
- [ ] Lighthouse `/kit` mobile ≥ 92
- [ ] Smoke prod `/kit` contient EN TOUT / 5 minutes / RÉSULTAT / Démarrer le rituel
- [ ] Aucune mention nominale fondatrice
- [ ] README handoff publié
- [ ] KPIs J+7 monitorés (§7.1)
