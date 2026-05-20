# 09 — Runbook d'exécution

Procédure pas-à-pas pour livrer la refonte. À suivre dans l'ordre. Chaque
phase a son **rollback** documenté.

## 0. Pré-requis (avant de commencer)

```bash
# Vérifications environnement
node --version       # ≥ 20.x (frozen)
pnpm --version       # ≥ 9.15.x

# Branche propre
git status           # working tree clean
git pull origin master

# Install + sanity
pnpm install --frozen-lockfile
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run --reporter=verbose 2>&1 | tail -5
# Expected: « Tests N passed (N) » — pas de fail
```

Si l'un de ces checks échoue → **stop, investiguer avant de démarrer**.

## 1. Phase 0 — Quick wins Kolenda

### 1.1 Setup

```bash
git checkout -b feat/composition-phase-0
```

### 1.2 Étapes

#### 1.2.1 Test-first PostCtaLink

Créer `apps/web/src/components/commerce/PostCtaLink.test.tsx` (~6 cas).
Lancer :
```bash
pnpm --filter web exec vitest run src/components/commerce/PostCtaLink.test.tsx
```
✗ Tous les tests doivent **échouer** (composant pas encore implémenté).

#### 1.2.2 Implémenter PostCtaLink

`apps/web/src/components/commerce/PostCtaLink.tsx` — voir doc 05 §8.

Lancer à nouveau les tests : ✓ tous verts.

#### 1.2.3 Lignes alternées dans IngredientsTable

Modifier `apps/web/src/components/commerce/IngredientsTable.tsx` :
```tsx
{ingredients.map((ing, i) => (
  <tr className={i % 2 === 0 ? 'bg-creme' : 'bg-creme-warm/40'}>…
```

#### 1.2.4 Brancher PostCtaLink dans IngredientsDetails

`apps/web/src/components/sections/IngredientsDetails.tsx` ajoute :
```tsx
{composition.map((sub) => (
  <div key={sub.id} id={`${anchor}-${sub.id}`}>
    <IngredientsTable subProduct={sub} />
    <PostCtaLink href="#commander-femiglow" subProductId={sub.id} />
  </div>
))}
```

#### 1.2.5 Schema tracking

`apps/web/src/lib/tracking/schemas.ts` ajout :
```ts
composition_post_cta_click: z.object({
  sub_product_id: z.string(),
  cta_target: z.string(),
}).strict(),
```

#### 1.2.6 Verify

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run
```

#### 1.2.7 Smoke

```bash
pnpm --filter web dev
# Ouvrir http://localhost:3000/kit
# Scroller à la section composition
# Cliquer sur « Voir le pack ↓ » sous le 1er sous-produit
# Vérifier scroll smooth vers #commander-femiglow
# DevTools Network : composition_post_cta_click émis
```

#### 1.2.8 Commit + push

```bash
git add apps/web/src/components/commerce/PostCtaLink.tsx \
        apps/web/src/components/commerce/PostCtaLink.test.tsx \
        apps/web/src/components/commerce/IngredientsTable.tsx \
        apps/web/src/components/sections/IngredientsDetails.tsx \
        apps/web/src/lib/tracking/schemas.ts
git commit -m "feat(composition): phase 0 — post-CTA + lignes alternées Kolenda"
git push origin feat/composition-phase-0
```

### 1.3 Rollback Phase 0

```bash
git revert <commit-hash>
git push
```

Aucun side-effect runtime : 100 % réversible.

---

## 2. Phase 1 — Schema étendu

### 2.1 Setup

Soit on continue sur la même branche, soit `git checkout -b feat/composition-phase-1`.

### 2.2 Étapes

#### 2.2.1 Test-first schemas

Créer `apps/web/src/lib/schemas/product.composition.test.ts` (~15 cas) :
- rétro-compat sans extensions
- accept narrative/usageHint/inciDefinition valides
- refus pour valeurs invalides

```bash
pnpm --filter web exec vitest run src/lib/schemas/product.composition.test.ts
# ✗ Tests échouent (schemas pas encore étendus)
```

#### 2.2.2 Étendre schemas

`apps/web/src/lib/schemas/product.ts` :
- `ingredientDetailedSchema` : ajout `inciDefinition`
- `subProductSchema` : ajout `narrative`, `usageHint`

#### 2.2.3 Enrichir mock

`apps/web/src/data/mock/kit.ts` : pour chaque sous-produit :
- 1 `narrative`
- 1 `usageHint`
- 1 `inciDefinition` par ingrédient (5 × 3 = 15 définitions)

**Important** : pas de mention nominale de la fondatrice — utiliser
« la maison », « l'atelier de Rabat », « la coopérative » comme dans le
playbook Kolenda.

#### 2.2.4 Helper sortByConcentrationDesc

`apps/web/src/lib/kit/composition/sort.ts` (~30 lignes) + tests (~5 cas).

#### 2.2.5 Verify

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run src/lib/schemas src/lib/kit/composition src/data
```

#### 2.2.6 Commit

```bash
git add apps/web/src/lib/schemas/product.ts \
        apps/web/src/lib/schemas/product.composition.test.ts \
        apps/web/src/data/mock/kit.ts \
        apps/web/src/lib/kit/composition/sort.ts \
        apps/web/src/lib/kit/composition/sort.test.ts
git commit -m "feat(composition): phase 1 — schema étendu (narrative, usageHint, inciDefinition)"
git push origin feat/composition-phase-1
```

### 2.3 Rollback Phase 1

```bash
git revert <commit-hash>
```

Side-effect : si Phase 2 / 3 / 4 sont déjà déployés, ils continueront de
fonctionner (rétro-compat — fallback sur fields manquants).

---

## 3. Phase 2 — IngredientCard mobile

### 3.1 Setup

```bash
git checkout -b feat/composition-phase-2
```

### 3.2 Étapes

(Plus complexe — voir doc 05 §3-7 pour le détail de chaque composant.)

#### 3.2.1 Test-first IngredientCard

`IngredientCard.test.tsx` (~10 cas). Mocks `next/image` et `useTracking`.

#### 3.2.2 Implémenter IngredientCard

`components/commerce/IngredientCard.tsx`. Pas encore de tooltip (Phase 3).

#### 3.2.3 Implémenter ResponsiveIngredientList

Split mobile (cards) / desktop (table).

#### 3.2.4 Refactor IngredientsTable signature

`IngredientsTable.tsx` : signature passe de `{subProduct}` à `{ingredients,
subProductId, accentColor}`. Mettre à jour ses tests.

#### 3.2.5 SubProductBlock

`SubProductBlock.tsx` (~10 cas tests). C'est le composant le plus complexe :
- `<details>` accordéon mobile (ouvert par défaut sur 1er, fermé pour les 2 autres)
- Détection breakpoint sm+ → force `open` sans accordéon
- NumberBadge + title + usageHint dans `<summary>`
- Émet `composition_accordion_open` au toggle

#### 3.2.6 Refonte IngredientsDetails

Remplacer la boucle actuelle par `<SubProductBlock>` pour chaque sous-produit.

#### 3.2.7 Verify

```bash
pnpm --filter web exec vitest run src/components/commerce src/components/sections/IngredientsDetails
pnpm --filter web exec tsc --noEmit
```

#### 3.2.8 Smoke mobile + desktop

```bash
pnpm --filter web dev
# Mobile 375×812 :
#   - aucun scroll horizontal
#   - 1er sous-produit ouvert, les 2 autres fermés
#   - Click summary → ouvre/ferme
#   - Cards verticales lisibles
# Desktop 1280×800 :
#   - Tableaux 5 colonnes complets
#   - Pas de chevron accordéon
#   - Tous les sous-produits visibles
```

#### 3.2.9 Commit

```bash
git commit -m "feat(composition): phase 2 — IngredientCard mobile + SubProductBlock"
```

### 3.3 Rollback Phase 2

`git revert` les commits Phase 2. La page retombe sur le tableau existant
(Phase 1 reste effective via schema). UI dégradée mais fonctionnelle.

---

## 4. Phase 3 — InciTooltip

### 4.1 Étapes

#### 4.1.1 Test-first InciTooltip

`InciTooltip.test.tsx` (~8 cas).

#### 4.1.2 Implémenter

Utilise l'API HTML5 `popover="auto"`. Fallback `<details>` si non supporté.

#### 4.1.3 Brancher dans IngredientCard + IngredientsTable

Conditionnel : si `ingredient.inciDefinition` présent, afficher le bouton ⓘ.

#### 4.1.4 Tracking event

`composition_inci_tooltip_open` dans `lib/tracking/schemas.ts`.

#### 4.1.5 Smoke

- Mobile : tap ⓘ → popover visible, définition lisible
- Esc / tap-out → popover fermé
- Axe 0 violation sur popover

#### 4.1.6 Commit

```bash
git commit -m "feat(composition): phase 3 — InciTooltip + tracking"
```

### 4.2 Rollback Phase 3

`git revert`. Les ingredients restent affichés sans bouton ⓘ. La
définition reste dans le mock mais non rendue. 100 % réversible.

---

## 5. Phase 4 — Lien pack + tracking enrichi

### 5.1 Étapes

#### 5.1.1 NarrativeIntro

`NarrativeIntro.tsx` (~5 cas tests).

IntersectionObserver pour émettre `composition_narrative_view` quand
l'intro entre dans le viewport (seuil 0.5).

#### 5.1.2 SubProductBlock — accordion tracking

Ajouter `onToggle` à `<details>` qui émet `composition_accordion_open`
quand l'élément passe à `open === true`.

#### 5.1.3 Schema events

```ts
composition_accordion_open: …
composition_narrative_view: …
```

#### 5.1.4 Verify

```bash
pnpm --filter web exec vitest run
pnpm --filter web dev
# DevTools Network : vérifier les 4 events dans /api/track/events
```

#### 5.1.5 Commit

```bash
git commit -m "feat(composition): phase 4 — NarrativeIntro + tracking accordion/narrative"
```

---

## 6. Phase 5 — Admin éditeur composition

### 6.1 Étapes (mirroir video phase 6)

#### 6.1.1 Sous-phase 5.A — Store + resolver + types

Créer `lib/kit/composition/{types,store,resolver,schemas}.ts` + tests
(~20 cas). Pattern identique à `lib/kit/video/`.

```bash
pnpm --filter web exec vitest run src/lib/kit/composition
git commit -m "feat(composition): phase 5.A — kit-composition resolver + schemas + store"
```

#### 6.1.2 Sous-phase 5.B — API routes

3 fichiers :
- `app/api/admin/kit/composition/[id]/route.ts` (GET, PATCH)
- `app/api/admin/kit/composition/[id]/publish/route.ts` (POST)
- `app/api/admin/kit/composition/[id]/reset/route.ts` (POST)

Plus leurs `.test.ts` (~18 cas).

```bash
git commit -m "feat(composition): phase 5.B — API routes admin/kit/composition"
```

#### 6.1.3 Sous-phase 5.C — Admin UI

5 composants :
- `KitCompositionEditor.tsx`
- `IngredientsArrayEditor.tsx`
- `CertificationsEditor.tsx`
- `CompositionPreviewCard.tsx`
- `KitCompositionResetDialog.tsx`

Plus leurs tests (~35 cas).

```bash
git commit -m "feat(composition): phase 5.C — admin KitCompositionEditor + sous-forms"
```

#### 6.1.4 Sous-phase 5.D — Pages + bind public

- `app/admin/kit/composition/page.tsx` (RSC liste)
- `app/admin/kit/composition/[id]/page.tsx` (RSC éditeur)
- Ajouter `kit-composition` à `AdminShell.active`
- `components/sections/IngredientsDetailsBound.tsx` — RSC wrapper qui
  appelle `resolveKitComposition()` puis délègue à `IngredientsDetails`

```bash
git commit -m "feat(composition): phase 5.D — pages admin + IngredientsDetailsBound public"
```

#### 6.1.5 Smoke admin complet

Cycle nominal :
1. Se connecter `/admin/kit/composition/1-paste`
2. Modifier `narrative` → Save → vérifier success
3. Click Publish → success
4. Visiter `/kit` → narrative custom visible
5. Click Reset → confirmation `RESET-COMPOSITION-1-PASTE` → revient au mock
6. Visiter `/kit` → narrative mock restaurée

---

## 7. Phase 6 — E2E Playwright + axe

### 7.1 Étapes

#### 7.1.1 Specs

- `e2e/composition-detail.spec.ts` (4 describe, ~15 cas)
- `e2e/admin-composition-detail.spec.ts` (5 cas)

#### 7.1.2 Run

```bash
pnpm --filter web exec playwright test --grep '@composition-'
# 3 runs consécutifs minimum — 0 flake
```

#### 7.1.3 Commit

```bash
git commit -m "test(composition): phase 6 — E2E Playwright + a11y axe"
```

---

## 8. Phase 7 — README handoff + cleanup

### 8.1 Étapes

1. Étendre `apps/web/src/components/kit/README.md` (section ingredients
   refondue avec table des composants, conventions, etc.).
2. Vérifier no-orphan : `grep -rn "subProduct={" apps/web/src/components` → tous
   les appels mis à jour
3. `pnpm lint`, `pnpm typecheck`, `pnpm build` exit 0
4. `pnpm vitest run --coverage` — viser ≥ 90 % branches sur `lib/kit/composition/**`

```bash
git commit -m "chore(composition): phase 7 — README handoff + cleanup"
```

---

## 9. Déploiement

### 9.1 Pré-déploiement

```bash
# Sur la branche merge candidate
git checkout master
git pull origin master
git merge feat/composition-phase-X --no-ff
# (ou via PR + squash sur GitHub)

# Sanity
pnpm install --frozen-lockfile
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run
pnpm --filter web build
```

### 9.2 Déploiement

`git push origin master` → CI Vercel déclenche le build prod. Sur succès :
- Vérifier `/kit` en prod : section composition refondue
- Vérifier `/admin/kit/composition/1-paste` (avec session admin) : éditeur OK
- Monitor logs Vercel pour erreurs 500 sur les nouvelles routes

### 9.3 Smoke prod

```bash
curl -sI https://femiglow.example.com/kit | head -5
# Status 200, content-type text/html

curl -sI https://femiglow.example.com/api/admin/kit/composition/1-paste
# Status 401 (sans cookie admin)
```

### 9.4 Rollback prod

Si problème détecté en prod :
```bash
git revert <merge-commit-hash>
git push origin master
# Vercel rebuild + redéploie
```

Ou rollback immédiat via interface Vercel (préviligier ce path : pas
besoin de toucher git).

## 10. Post-déploiement (J+7 / J+30)

### 10.1 Monitoring KPIs J+7

| KPI | Valeur attendue | Action si non atteint |
|---|---|---|
| `composition_post_cta_click` (count/24h) | ≥ 5 % visiteurs `/kit` | Investiguer position lien |
| `composition_inci_tooltip_open` (count/24h) | ≥ 10 % visiteurs section | Vérifier visibilité du ⓘ |
| `composition_accordion_open` (count/24h) | ≥ 35 % mobile | Vérifier conformité UX §7 |
| Aucun pic d'erreur 5xx sur `/kit` ou `/api/admin/kit/composition/*` | 0 erreur | Investiguer logs Vercel |
| Lighthouse `/kit` mobile | ≥ 92 | Check bundle delta |

### 10.2 KPIs J+30 (cf. doc 02 §3)

- Temps moyen ≥ 25 s ✅
- Scroll-through ≥ 70 % ✅
- Taux ouverture accordion ≥ 40 % ✅
- Taux clic tooltip ≥ 15 % ✅
- Clic « Voir le pack » ≥ 8 % ✅

Si KPIs non atteints à J+30, créer un dossier d'analyse `docs/composition-detail-iter-2026-06/` pour A/B testing.

## 11. Communication

### 11.1 Annonce interne au démarrage

> « Démarrage refonte section composition (`Le détail · La composition lue
> ligne par ligne.`). 8 phases, ~3,5 j-h, livraison cible 2 semaines.
> Plan complet : `docs/ingredients-detail-optim-2026-05/`. »

### 11.2 Annonce déploiement

> « Refonte section ingrédients déployée en prod. KPIs à monitorer J+7 et
> J+30. Admin éditeur disponible : `/admin/kit/composition`. »

### 11.3 Annonce KPIs J+30

Bilan factuel : valeurs atteintes vs cibles, hypothèses validées /
infirmées, prochaines itérations.

## 12. Anti-patterns dans l'exécution

| Anti-pattern | Risque | Mitigation |
|---|---|---|
| Sauter test-first pour gagner du temps | Régression silencieuse | Gate au commit : vitest run obligatoire |
| Mélanger Phase 1 + 2 dans un commit | Rollback impossible | 1 phase = 1+ commit ciblé |
| Publier en prod sans cycle Save→Publish→Reset validé | Admin cassé en prod | Smoke admin obligatoire avant push |
| Refactor `IngredientsTable` sans toucher ses tests | Tests verts sur ancien comportement | Refactor tests d'abord, ensuite le composant |
| Push sur `master` sans `frozen-lockfile` réussi local | CI casse à l'install | Toujours `pnpm install --frozen-lockfile` avant push |
| Modifier les schemas et publier sans vérifier la rétro-compat | Casse les overrides existants en mémoire | Test explicite « SubProduct sans extensions valide » |
| Push sans `tsc --noEmit` réussi | Build prod casse, déploiement bloqué | Pre-commit hook (déjà actif) |
