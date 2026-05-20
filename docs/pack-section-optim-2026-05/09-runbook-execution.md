# 09 — Runbook d'exécution

Procédure pas-à-pas pour livrer la refonte de la section « Le Pack ».
À suivre **dans l'ordre**. Chaque phase a son **rollback** documenté et son
**smoke test** avant commit.

> Référence du plan : `08-plan-action-phases.md`.
> Référence Kolenda : `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §4.6.

## 0. Pré-requis (avant de commencer)

```bash
# Vérification environnement
node --version       # >= 20.x (frozen)
pnpm --version       # >= 9.15.9 (cf. packageManager dans package.json racine)

# Branche propre
git status           # working tree clean
git pull origin master

# Install + sanity
pnpm install --frozen-lockfile
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run --reporter=verbose 2>&1 | tail -5
# Expected: « Tests N passed (N) » — aucun fail

# Build smoke
pnpm --filter web build
# Expected: build complete sans warning sévère
```

Si l'un de ces checks échoue → **stop, investiguer avant de démarrer**.

### 0.1 Pré-lecture obligatoire

Avant la première ligne de code :

1. Lire `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §4.6 (« Le Pack ») — version
   complète, pas le résumé.
2. Lire `01-context-analyse.md` (le diagnostic Kolenda actuel).
3. Lire `05-frontend-public-design.md` (les composants à créer).
4. Lire `apps/web/src/components/sections/ProductFeedSection.tsx` (l'existant
   à refondre).

### 0.2 Convention de nommage des branches

| Phase | Branche | Commit prefix |
|---|---|---|
| 0 | `feat/pack-phase-0-pricing` | `feat(pack):` |
| 1 | `feat/pack-phase-1-cta` | `feat(pack):` |
| 2 | `feat/pack-phase-2-social-proof` | `feat(pack):` |
| 3 | `feat/pack-phase-3-packshot` | `feat(pack):` |
| 4.A | `feat/pack-phase-4a-store` | `feat(pack):` |
| 4.B | `feat/pack-phase-4b-api` | `feat(pack):` |
| 4.C | `feat/pack-phase-4c-admin-ui` | `feat(pack):` |
| 4.D | `feat/pack-phase-4d-admin-pages` | `feat(pack):` |
| 5 | `test/pack-phase-5-e2e` | `test(pack):` |
| 6 | `docs/pack-phase-6-readme` | `docs(pack):` |

Toutes les branches partent de `master` à jour.

---

## 1. Phase 0 — Quick wins Pricing (½ j-h)

### 1.1 Setup

```bash
git checkout master && git pull
git checkout -b feat/pack-phase-0-pricing
```

### 1.2 Étapes

#### 1.2.1 Test-first helper `computePackSavings`

Créer `apps/web/src/lib/kit/pack/savings.test.ts` (~8 cas) :

- Retour `null` si pas de prix barré
- Calcul économie en EUR
- Calcul économie en %
- Arrondi entier
- Refus prix barré <= prix final (cohérence)
- Conversion devise (EUR uniquement pour Phase 0)
- Robust formatting (FR locale: « 14 € »)

Lancer :

```bash
pnpm --filter web exec vitest run src/lib/kit/pack/savings.test.ts
```

Tous les tests doivent **échouer** (helper pas encore implémenté).

#### 1.2.2 Implémenter `computePackSavings`

`apps/web/src/lib/kit/pack/savings.ts` — voir doc 03 §3.

Re-lancer : tous verts.

#### 1.2.3 Test-first helper `buildPerUsageHint`

Créer `apps/web/src/lib/kit/pack/per-usage.test.ts` (~5 cas).

#### 1.2.4 Implémenter `buildPerUsageHint`

`apps/web/src/lib/kit/pack/per-usage.ts` — voir doc 03 §3.

#### 1.2.5 Étendre schemas `productFeedHero`

`apps/web/src/lib/schemas/product-feed.ts` :

- `productFeedHeroSchema` ajout fields optionnels :
  - `valueBreakdown?: Array<{label: string; valueLabel: string; muted?: boolean}>`
  - `perUsageHint?: string`
  - `ctaAccent?: 'sauge-dark' | 'champagne' | 'terracotta'`

**Important** : tous les fields **optionnels** pour rétro-compat. Tests
`product-feed.test.ts` doivent prouver que les overrides existants restent
valides.

#### 1.2.6 Mock data

`apps/web/src/data/mock/kit.ts` — ajouter dans `productFeed.hero` :

```ts
priceCompareAt: '49 €',
priceCompareAtAriaLabel: 'Prix non packagé',
valueBreakdown: [
  { label: '1 Paste · 30 ml', valueLabel: '19 €' },
  { label: '2 Powder · 30 g', valueLabel: '14 €' },
  { label: 'Polissoir 4 zones', valueLabel: '12 €' },
  { label: 'Notice rituel + carte', valueLabel: 'offert', muted: true },
],
perUsageHint: '≈ 0,75 € par soin sur 30 jours',
ctaAccent: 'sauge-dark',
```

**Convention copy** :
- Pas de « Souheila » — utiliser « la maison », « l'atelier de Rabat ».
- L'économie est dérivée du calcul (`computePackSavings`), pas stockée en
  dur.
- Le label de bandeau économie : `« Vous économisez 14 € · 29 % »` (calculé
  à l'affichage via le helper).

#### 1.2.7 Composants publics

Créer (test-first puis impl) :

- `apps/web/src/components/sections/ValueBreakdownList.tsx` (Server)
- `apps/web/src/components/sections/ValueBreakdownList.test.tsx` (~6 cas)
- `apps/web/src/components/sections/PriceBlock.tsx` (Client — émet
  `pack_economy_view` via IntersectionObserver)
- `apps/web/src/components/sections/PriceBlock.test.tsx` (~10 cas)

#### 1.2.8 Brancher dans `ProductFeedSection`

Refactor `apps/web/src/components/sections/ProductFeedSection.tsx` :

- Extraire le bloc prix actuel dans `<PriceBlock>` (props : `hero`, `savings`).
- Brancher `ValueBreakdownList` sous le prix XXL.
- Garder le CTA dans `ProductFeedSection` pour Phase 1 (refonte distincte).

#### 1.2.9 Schemas tracking

`apps/web/src/lib/tracking/schemas.ts` ajout :

```ts
pack_economy_view: z.object({
  savings_eur: z.number(),
  savings_pct: z.number(),
}).strict(),
```

#### 1.2.10 Verify

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run src/lib/kit/pack src/lib/schemas/product-feed src/components/sections/ValueBreakdownList src/components/sections/PriceBlock src/components/sections/ProductFeedSection
pnpm --filter web exec vitest run  # full suite — pas de régression
```

#### 1.2.11 Smoke browser

```bash
pnpm --filter web dev
# Ouvrir http://localhost:3000/kit
# Scroller à #product-feed (la section « Le Pack »)
# Vérifier :
# - Prix barré 49 € visible
# - Prix XXL « 35 € »
# - Bandeau « Vous économisez 14 € · 29 % » en terracotta #C28A6E
# - Liste valueBreakdown sous le prix avec « offert » muted
# - Microcopy « ≈ 0,75 € par soin sur 30 jours »
# - DevTools Network → en scrollant : 1 event pack_economy_view avec savings_eur=14, savings_pct=29
```

#### 1.2.12 Commit

```bash
git add apps/web/src/lib/kit/pack apps/web/src/lib/schemas/product-feed.ts \
        apps/web/src/lib/tracking/schemas.ts \
        apps/web/src/data/mock/kit.ts \
        apps/web/src/components/sections/ValueBreakdownList.tsx \
        apps/web/src/components/sections/ValueBreakdownList.test.tsx \
        apps/web/src/components/sections/PriceBlock.tsx \
        apps/web/src/components/sections/PriceBlock.test.tsx \
        apps/web/src/components/sections/ProductFeedSection.tsx
git commit -m "feat(pack): phase 0 — pricing Kolenda (savings, valueBreakdown, per-usage)"
git push origin feat/pack-phase-0-pricing
```

### 1.3 Rollback Phase 0

```bash
git revert <commit-hash>
git push
```

Aucun side-effect runtime — 100 % réversible. Les helpers `computePackSavings`
et `buildPerUsageHint` sont purs, leur dépublication ne casse rien.

---

## 2. Phase 1 — CTA refonte (¼ j-h)

### 2.1 Setup

```bash
git checkout master && git pull
git checkout -b feat/pack-phase-1-cta
```

### 2.2 Étapes

#### 2.2.1 Modifier label CTA

`apps/web/src/lib/products/feed/kit-feed.ts` builder :

```ts
ctaLabel: 'Commander le rituel',  // était 'Recevoir le pack'
```

Et dans le mock fallback (`apps/web/src/data/mock/kit.ts`).

#### 2.2.2 Variants Tailwind

`apps/web/tailwind.config.ts` ajout keyframe `soft-pulse` :

```ts
keyframes: {
  'soft-pulse': {
    '0%, 100%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.02)' },
  },
},
animation: {
  'soft-pulse': 'soft-pulse 3.5s ease-in-out infinite',
},
```

#### 2.2.3 PriceBlock CTA

Dans `PriceBlock.tsx` (créé Phase 0) — le CTA utilise déjà `hero.ctaAccent`.
Mapper :

- `'sauge-dark'` → `bg-sauge-700 text-creme hover:bg-sauge-800`
- `'champagne'` → existant (par défaut)
- `'terracotta'` → `bg-[#C28A6E] text-creme`

Ajouter `motion-safe:animate-soft-pulse` sur la classe CTA quand
`ctaAccent === 'sauge-dark'`.

#### 2.2.4 Tracking event `pack_cta_click`

`apps/web/src/lib/tracking/schemas.ts` :

```ts
pack_cta_click: z.object({
  source: z.literal('pack_section'),
  cta_label: z.string(),
  cta_accent: z.enum(['sauge-dark', 'champagne', 'terracotta']),
}).strict(),
```

Dans `PriceBlock.tsx` (ou wrapper) — au click du CTA, émettre l'event puis
suivre le `ctaHref` (anchor `#commander-femiglow`).

#### 2.2.5 Tests

`PriceBlock.test.tsx` — ajouter cas :

- CTA label « Commander le rituel »
- Variant `sauge-dark` applique bg-sauge-700
- Au click → `pack_cta_click` émis avec params corrects
- `motion-safe:animate-soft-pulse` présente quand variant sauge-dark
- Pas d'animation sur `prefers-reduced-motion` (test via media query mock)

#### 2.2.6 Verify

```bash
pnpm --filter web exec vitest run src/components/sections/PriceBlock src/lib/products/feed
pnpm --filter web exec tsc --noEmit
```

#### 2.2.7 Smoke

```bash
pnpm --filter web dev
# /kit → section pack :
# - CTA « Commander le rituel » en vert sauge foncé (#4A5D4F approx)
# - Micro-pulse perceptible (toutes les 3,5s)
# - Click CTA → tracking pack_cta_click + scroll #commander-femiglow
# - Activer prefers-reduced-motion (DevTools Rendering) → plus d'animation
```

#### 2.2.8 Commit

```bash
git commit -m "feat(pack): phase 1 — CTA refonte (sauge-dark + micro-pulse + tracking)"
git push origin feat/pack-phase-1-cta
```

### 2.3 Rollback Phase 1

`git revert`. Le CTA retombe sur le label précédent et la couleur d'origine.

---

## 3. Phase 2 — Social proof libellé + position (¼ j-h)

### 3.1 Setup

```bash
git checkout master && git pull
git checkout -b feat/pack-phase-2-social-proof
```

### 3.2 Étapes

#### 3.2.1 Schema extension

`apps/web/src/lib/schemas/product-feed.ts` :

```ts
productFeedSocialProofSchema = productFeedSocialProofSchema.extend({
  countLabelGeo: z.string().optional(),  // ex. « 287 maisons à Paris »
});
```

#### 3.2.2 Mock

`apps/web/src/data/mock/kit.ts` :

```ts
socialProof: {
  ...
  countLabel: '287 avis',
  countLabelGeo: '287 maisons en France',
},
```

#### 3.2.3 ProductFeedSection — repositionner social proof

Déplacer le bloc social proof dans `<PriceBlock>` (juste sous le CTA, avant
la microcopy de réassurance « Livraison + Satisfait ou remboursé »).

Si `countLabelGeo` présent → l'afficher en priorité. Sinon fallback sur
`countLabel`.

#### 3.2.4 Tracking `pack_social_proof_view`

`apps/web/src/lib/tracking/schemas.ts` :

```ts
pack_social_proof_view: z.object({
  rating: z.number(),
  count: z.number(),
  label_used: z.enum(['geo', 'count']),
}).strict(),
```

IntersectionObserver dans `PriceBlock` ou helper `SocialProofTracker` —
émettre une seule fois au seuil 0.5.

#### 3.2.5 Tests

`PriceBlock.test.tsx` ou nouveau `SocialProofTracker.test.tsx` (~5 cas) :

- Affiche `countLabelGeo` si présent
- Fallback `countLabel` si absent
- Émet `pack_social_proof_view` une seule fois
- N'émet pas si pas dans le viewport

#### 3.2.6 Verify + smoke

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run
pnpm --filter web dev
# /kit → vérifier que « ★ 4,8/5 · 287 maisons en France » est désormais
# affiché SOUS le CTA, dans le bloc prix (et plus en bas de la section).
```

#### 3.2.7 Commit

```bash
git commit -m "feat(pack): phase 2 — social proof repositionné + label géo"
git push origin feat/pack-phase-2-social-proof
```

### 3.3 Rollback Phase 2

`git revert`. Le social proof retombe à sa position précédente.

---

## 4. Phase 3 — Packshot + reveal (1 j-h)

### 4.1 Setup

```bash
git checkout master && git pull
git checkout -b feat/pack-phase-3-packshot
```

### 4.2 Étapes

#### 4.2.1 Test-first PackVisual

`apps/web/src/components/sections/PackVisual.test.tsx` (~8 cas) :

- Rend `<img>` avec `src='/products/kit-principale.svg'` par défaut
- Override via `visualSrc` prop
- Alt text obligatoire
- Aspect ratio 4/5 preserved
- Lazy-loading par défaut
- Wrapper `Reveal` avec stagger=0

#### 4.2.2 Implémenter PackVisual

`apps/web/src/components/sections/PackVisual.tsx` (Server Component) — voir
doc 05 §5.

Utilise `next/image` avec `src` par défaut `/products/kit-principale.svg`.

#### 4.2.3 Reveal stagger orchestrator

Si pas encore présent dans `ProductFeedSection`, wrapper le contenu hero :

```tsx
<LazyMotion features={domAnimation}>
  <m.div animate={...} initial={...}>
    <Reveal delay={0}>{kicker + title}</Reveal>
    <Reveal delay={0.05}>{lead}</Reveal>
    <Reveal delay={0.1}>{priceBlock}</Reveal>
    <Reveal delay={0.15}>{packVisual}</Reveal>
  </m.div>
</LazyMotion>
```

`prefers-reduced-motion` désactive l'animation (déjà géré par `Reveal`).

#### 4.2.4 Layout 2 colonnes desktop

`ProductFeedSection.tsx` — sur sm+ (`md:grid md:grid-cols-2`), gauche =
hero (kicker→CTA), droite = packshot. Sur mobile, packshot en dessous.

#### 4.2.5 Tracking `pack_section_view`

`apps/web/src/lib/tracking/schemas.ts` :

```ts
pack_section_view: z.object({
  has_visual: z.boolean(),
  layout: z.enum(['mobile', 'desktop']),
}).strict(),
```

IntersectionObserver wrapper `PackSectionTracker.tsx` (Client) — émet une
seule fois au seuil 0.3.

#### 4.2.6 Tests

`PackVisual.test.tsx`, `PackSectionTracker.test.tsx` (~5 cas chacun).

#### 4.2.7 Verify

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run src/components/sections
```

#### 4.2.8 Smoke mobile + desktop

```bash
pnpm --filter web dev
# Mobile 375×812 :
#   - Hero en colonne unique
#   - Packshot SOUS le bloc prix
#   - Pas de scroll horizontal
# Desktop 1280×800 :
#   - 2 colonnes (texte gauche, packshot droite)
#   - Reveal stagger visible au scroll
# prefers-reduced-motion ON :
#   - Aucune animation, contenu immédiatement visible
```

#### 4.2.9 Commit

```bash
git commit -m "feat(pack): phase 3 — packshot + reveal stagger + layout 2 colonnes"
git push origin feat/pack-phase-3-packshot
```

### 4.3 Rollback Phase 3

`git revert`. La section retombe à 1 colonne sans packshot. Le bloc prix +
le CTA restent fonctionnels (Phases 0–2 préservées).

---

## 5. Phase 4 — Admin éditeur singleton (¾ j-h)

Phase composée — la subdiviser en 4 sous-phases atomiques A/B/C/D.

### 5.A — Store + resolver + types

#### 5.A.1 Setup

```bash
git checkout master && git pull
git checkout -b feat/pack-phase-4a-store
```

#### 5.A.2 Étapes

Créer (test-first) :

- `apps/web/src/lib/kit/pack/types.ts` — `KitPackOverride`, `PackResolved`, `KitPackSource`
- `apps/web/src/lib/kit/pack/schemas.ts` — `kitPackOverrideUpsertSchema` (Zod)
- `apps/web/src/lib/kit/pack/store.ts` — memoryStore via `ext()` clé `'kit-pack'`
- `apps/web/src/lib/kit/pack/resolver.ts` — `resolveKitPack()` / `resolveKitPackDraft()`

Tests : ~20 cas total (rétro-compat schema, store CRUD, cascade resolver,
unicité du singleton).

```bash
pnpm --filter web exec vitest run src/lib/kit/pack
git commit -m "feat(pack): phase 4.A — kit-pack types + schemas + store + resolver"
git push origin feat/pack-phase-4a-store
```

### 5.B — API routes

#### 5.B.1 Setup

```bash
git checkout -b feat/pack-phase-4b-api
```

#### 5.B.2 Étapes

Créer (test-first) :

- `apps/web/src/app/api/admin/kit/pack/route.ts` — GET + PATCH
- `apps/web/src/app/api/admin/kit/pack/publish/route.ts` — POST
- `apps/web/src/app/api/admin/kit/pack/reset/route.ts` — POST

Pattern identique à `api/admin/kit/composition/[id]/*`. Auth via session
admin (`getAdminSession`), validation Zod, audit log (`kit_pack.update`,
`kit_pack.publish`, `kit_pack.unpublish`, `kit_pack.reset`), `revalidateTag('kit-pack')`.

Tests `.test.ts` (~18 cas) : 401 sans session, 400 sur Zod fail, 200 sur
nominal, side-effects (`auditLog`, `revalidateTag`) appelés.

```bash
pnpm --filter web exec vitest run src/app/api/admin/kit/pack
git commit -m "feat(pack): phase 4.B — API routes admin/kit/pack (GET/PATCH/publish/reset)"
git push origin feat/pack-phase-4b-api
```

### 5.C — Admin UI

#### 5.C.1 Setup

```bash
git checkout -b feat/pack-phase-4c-admin-ui
```

#### 5.C.2 Étapes

Créer :

- `apps/web/src/components/admin/kit-pack/KitPackEditor.tsx` (Client) — form
  Zod safeParse live, dirty tracking, Save/Publish/Reset
- `apps/web/src/components/admin/kit-pack/ValueBreakdownEditor.tsx`
  (sous-form pour la liste ordonnée)
- `apps/web/src/components/admin/kit-pack/KitPackPreviewCard.tsx`
  (Server-renderable preview qui rejoue le rendu public en miniature)
- `apps/web/src/components/admin/kit-pack/KitPackResetDialog.tsx`
  (magic word `RESET-PACK`)

Tests `.test.tsx` (~30 cas) : voir doc 07 §3.B.

```bash
pnpm --filter web exec vitest run src/components/admin/kit-pack
git commit -m "feat(pack): phase 4.C — admin KitPackEditor + sous-forms + Preview + Reset dialog"
git push origin feat/pack-phase-4c-admin-ui
```

### 5.D — Pages admin + bind public

#### 5.D.1 Setup

```bash
git checkout -b feat/pack-phase-4d-admin-pages
```

#### 5.D.2 Étapes

Créer :

- `apps/web/src/app/admin/kit/pack/page.tsx` (RSC) — appelle
  `resolveKitPackDraft()` puis rend `<KitPackEditor>` côté client
- Ajouter `kit-pack` à l'inventaire `AdminShell` (`active` prop) avec label
  « Pack /kit »
- `apps/web/src/components/sections/ProductFeedSectionBound.tsx` (RSC) —
  wrapper qui appelle `resolveKitPack()` puis délègue à
  `ProductFeedSection` (avec le contenu hero override-injecté)
- Modifier `apps/web/src/app/kit/page.tsx` pour utiliser
  `<ProductFeedSectionBound>` au lieu du `<ProductFeedSection>` direct

Tests (~10 cas) : rendu RSC + rétro-compat sans override.

#### 5.D.3 Smoke admin complet

Cycle nominal :

1. Se connecter `/admin/kit/pack` (créer session admin si besoin)
2. Modifier `priceCompareAt` de `49 €` à `52 €`
3. Modifier `perUsageHint` à « ≈ 0,80 € par soin »
4. Vérifier dans le panneau Preview que le rendu reflète les changements
5. Click Save → success toast
6. Click Publish → success toast
7. Visiter `/kit` (un autre onglet) → savings recalculée à `17 € · 33 %`,
   per-usage à « ≈ 0,80 € »
8. Click Reset, taper `RESET-PACK`, confirm → success
9. Visiter `/kit` → retour aux valeurs mock par défaut

#### 5.D.4 Commit

```bash
git commit -m "feat(pack): phase 4.D — pages admin + ProductFeedSectionBound public"
git push origin feat/pack-phase-4d-admin-pages
```

### 5.E — Rollback Phase 4

`git revert` par sous-phase dans l'ordre inverse (D → C → B → A). Les
sous-phases A/B sont sans effet utilisateur sans C/D (l'admin n'est pas
exposé), donc leur revert est sans impact. Si seule C/D est rollback, la
page publique retombe sur le mock (puisque le `resolveKitPack` n'aura plus
de tag à invalider mais le builder reste fonctionnel).

---

## 6. Phase 5 — E2E Playwright + axe (½ j-h)

### 6.1 Setup

```bash
git checkout master && git pull
git checkout -b test/pack-phase-5-e2e
```

### 6.2 Étapes

#### 6.2.1 Specs

Créer :

- `apps/web/e2e/pack-section.spec.ts` (~10 cas) avec tags `@pack-render`,
  `@pack-interaction`, `@pack-a11y`
- `apps/web/e2e/admin-kit-pack.spec.ts` (~5 cas) avec tag `@pack-admin`

Détail des scénarios : voir doc 07 §5.

Pattern à suivre — voir `apps/web/e2e/admin-composition-detail.spec.ts`
comme référence (skip gracieux sans session admin).

#### 6.2.2 Run

```bash
pnpm --filter web exec playwright test --grep '@pack-'
# 3 runs consécutifs minimum — 0 flake
```

Si un test flake → investiguer (timing, sélecteur, données mock). Ne jamais
livrer un E2E flaky.

#### 6.2.3 Commit

```bash
git commit -m "test(pack): phase 5 — E2E Playwright + axe a11y"
git push origin test/pack-phase-5-e2e
```

### 6.3 Rollback Phase 5

Les E2E n'affectent pas le runtime. `git revert` n'a pas d'impact sur la prod.

---

## 7. Phase 6 — README handoff + cleanup (¼ j-h)

### 7.1 Setup

```bash
git checkout master && git pull
git checkout -b docs/pack-phase-6-readme
```

### 7.2 Étapes

#### 7.2.1 Étendre le README composants

`apps/web/src/components/sections/README.md` (créer si absent — pattern
miroir de `apps/web/src/components/kit/README.md`) avec :

- Table d'inventaire des nouveaux composants (`PriceBlock`,
  `ValueBreakdownList`, `PackVisual`, `PackSectionTracker`,
  `ProductFeedSectionBound`)
- Section « Conventions » (apostrophe `’`, accentColor optionnel, helpers
  purs)
- Section « Tests » (couverture cible ≥ 90 %)
- Lien vers `docs/pack-section-optim-2026-05/`

#### 7.2.2 Vérification no-orphan

```bash
grep -rn "ProductFeedSection " apps/web/src --include="*.tsx" --include="*.ts"
# Doit être remplacé par ProductFeedSectionBound dans /kit/page.tsx
```

#### 7.2.3 Couverture

```bash
pnpm --filter web exec vitest run --coverage src/lib/kit/pack src/components/sections/PriceBlock src/components/sections/ValueBreakdownList src/components/sections/PackVisual
# Viser >= 90 % branches sur lib/kit/pack/**
```

#### 7.2.4 Quality gates finaux

```bash
pnpm --filter web exec tsc --noEmit       # 0 erreur
pnpm --filter web exec vitest run         # tous verts
pnpm --filter web exec playwright test --grep '@pack-'  # 0 flake
pnpm --filter web build                   # exit 0
pnpm --filter web exec eslint .           # 0 error
```

#### 7.2.5 Commit

```bash
git commit -m "docs(pack): phase 6 — README handoff + cleanup final"
git push origin docs/pack-phase-6-readme
```

### 7.3 Rollback Phase 6

Doc-only — rollback sans impact runtime.

---

## 8. Déploiement

### 8.1 Pré-déploiement

```bash
# Sur la branche merge candidate
git checkout master && git pull origin master

# Merger les branches dans l'ordre Phase 0 → 6
git merge feat/pack-phase-0-pricing --no-ff
git merge feat/pack-phase-1-cta --no-ff
# ... etc. jusqu'à phase 6
# (ou via PR + squash sur GitHub avec rebase entre chaque)

# Sanity
pnpm install --frozen-lockfile
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec vitest run
pnpm --filter web build
```

### 8.2 Déploiement

`git push origin master` → CI Vercel déclenche le build prod. Sur succès :

- Vérifier `/kit` en prod : section pack refondue
- Vérifier `/admin/kit/pack` (avec session admin) : éditeur OK
- Vérifier que le feed XML Merchant reste inchangé :
  `curl -s https://femiglow.example.com/api/merchant-feed.xml | head -50`
  (le `g:price` doit toujours utiliser le prix du `product` brut, pas
  l'override)
- Monitor logs Vercel pour erreurs 500 sur les nouvelles routes
  `/api/admin/kit/pack/*`

### 8.3 Smoke prod

```bash
curl -sI https://femiglow.example.com/kit | head -5
# Status 200, content-type text/html

curl -sI https://femiglow.example.com/api/admin/kit/pack
# Status 401 (sans cookie admin)

# Vérifier social proof rendu côté SSR (sans JS)
curl -s https://femiglow.example.com/kit | grep -E '(287|4,8|économisez)'
# Doit retourner au moins les chaînes "économisez" et "4,8"
```

### 8.4 Rollback prod

Si problème détecté en prod :

```bash
git revert <merge-commit-hash>
git push origin master
# Vercel rebuild + redéploie
```

Ou rollback immédiat via interface Vercel (privilégier ce path : pas besoin
de toucher git, time-to-recovery ~30 s).

---

## 9. Post-déploiement (J+7 / J+30)

### 9.1 Monitoring KPIs J+7

| KPI | Valeur attendue | Action si non atteint |
|---|---|---|
| `pack_section_view` (count/24h) | ≥ 90 % visiteurs `/kit` | Vérifier IntersectionObserver |
| `pack_cta_click` (count/24h) | ≥ 8 % visiteurs section | Vérifier visibilité CTA mobile |
| `pack_economy_view` (count/24h) | ≥ 80 % visiteurs section | Vérifier seuil IO |
| `pack_social_proof_view` (count/24h) | ≥ 70 % visiteurs section | Vérifier position du bloc |
| Aucun pic d'erreur 5xx sur `/kit` ou `/api/admin/kit/pack/*` | 0 erreur | Investiguer logs Vercel |
| Lighthouse `/kit` mobile | ≥ 92 | Check bundle delta (PriceBlock ≤ 2 kB) |
| Bundle delta total `/kit` | ≤ +8 kB gzipped | Audit `next build` output |

### 9.2 KPIs J+30 (cf. doc 02 §3)

- CTR « Commander le rituel » 6 % → **≥ 10 %** ✅
- Add-to-cart rate `/kit` → +20 % ✅
- Scroll-through section pack ≥ 75 % ✅
- Temps moyen sur section ≥ 18 s ✅
- Taux ouverture admin /admin/kit/pack ≥ 1 session/semaine ✅

Si KPIs non atteints à J+30, créer un dossier d'analyse
`docs/pack-section-iter-2026-06/` pour A/B testing (variantes CTA accent,
position packshot, libellé social proof).

---

## 10. Communication

### 10.1 Annonce interne au démarrage

> « Démarrage refonte section "Le Pack" (`#product-feed` sur `/kit`).
> 7 phases, ~3,5 j-h, livraison cible 2 semaines.
> Plan complet : `docs/pack-section-optim-2026-05/`. »

### 10.2 Annonce déploiement

> « Refonte section pack déployée en prod. KPIs à monitorer J+7 et J+30.
> Admin éditeur disponible : `/admin/kit/pack` (édition pricing, value
> breakdown, per-usage, CTA accent, social proof). »

### 10.3 Annonce KPIs J+30

Bilan factuel : valeurs atteintes vs cibles, hypothèses validées /
infirmées, prochaines itérations.

---

## 11. Anti-patterns dans l'exécution

| Anti-pattern | Risque | Mitigation |
|---|---|---|
| Sauter test-first pour gagner du temps | Régression silencieuse | Gate au commit : vitest run obligatoire |
| Mélanger Phase 0 + 1 dans un commit | Rollback impossible | 1 phase = 1+ commit ciblé, branches séparées |
| Modifier `kit-feed.ts` (builder) **et** ajouter override admin en même temps | Le feed Merchant XML pourrait basculer sur l'override → casse les annonces Google | Toujours séparer : builder pur (mock) vs override admin (lecture-seule pour le rendu public, jamais dans le builder XML) |
| Publier en prod sans cycle Save→Publish→Reset validé | Admin cassé en prod | Smoke admin obligatoire avant push (cf. §5.D.3) |
| Refactor `ProductFeedSection` sans extraire `PriceBlock` d'abord | Composant >300 lignes, tests difficiles | Phase 0 d'abord, Phase 1 ensuite |
| Push sur `master` sans `frozen-lockfile` réussi local | CI casse à l'install | Toujours `pnpm install --frozen-lockfile` avant push |
| Modifier les schemas et publier sans vérifier la rétro-compat | Casse les overrides existants en mémoire | Test explicite « ProductFeedHero sans extensions valide » |
| Push sans `tsc --noEmit` réussi | Build prod casse, déploiement bloqué | Pre-commit hook (déjà actif) |
| Émettre `pack_economy_view` sans IntersectionObserver (fire-on-mount) | KPI faussé (toujours 100 %) | Toujours seuil IO ≥ 0.3, once=true |
| Mention nominale de la fondatrice dans la copy | Brand voice cassée | Sweep manuel sur le mock + revue PR obligatoire |

---

## 12. Checklist de fin

Avant de merger la dernière PR :

- [ ] Toutes les phases (0–6) commitées et mergées
- [ ] `tsc --noEmit` : 0 erreur
- [ ] `vitest run` : 0 fail
- [ ] `playwright test --grep '@pack-'` : 0 flake sur 3 runs
- [ ] `next build` : exit 0, bundle delta `/kit` ≤ +8 kB gzipped
- [ ] Lighthouse `/kit` mobile ≥ 92
- [ ] Coverage `lib/kit/pack/**` ≥ 90 % branches
- [ ] Smoke prod : `/kit` SSR contient « économisez », « 4,8 », « Commander le rituel »
- [ ] Smoke admin prod : `/admin/kit/pack` accessible avec session admin
- [ ] Feed Merchant XML inchangé (`g:price` toujours = prix mock, pas override)
- [ ] Aucune mention « Souheila » dans la copy
- [ ] README handoff publié (`components/sections/README.md`)
- [ ] Audit log contient les 4 actions (`update`/`publish`/`unpublish`/`reset`)
- [ ] KPIs J+7 monitorés (cf. §9.1)

Quand cette liste est verte → la refonte est livrée. Continuer avec
monitoring J+30 (§9.2).
