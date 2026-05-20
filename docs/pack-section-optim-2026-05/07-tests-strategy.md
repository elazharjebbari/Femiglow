# 07 — Stratégie de tests

Vitest (unit + integration MSW) + Playwright (E2E + a11y). Couverture
cible ≥ 90 % branches sur `lib/kit/pack/**`, ≥ 85 % sur
`components/commerce/PriceBlock*` et `components/sections/ProductFeedSection`.

## 1. Pyramide

```
       +-------------------+
       |  E2E Playwright   |  ~ 7 specs
       +-------------------+
      +---------------------+
      |  Integration MSW    |  ~ 6 specs
      +---------------------+
     +-----------------------+
     |   Unit (Vitest)       |  ~ 45 specs
     +-----------------------+
```

Cible : 80 % unit, 12 % MSW, 8 % E2E.

## 2. Outillage

| Couche | Outil | Localisation |
|---|---|---|
| Unit | Vitest + Testing Library | Co-localisée `*.test.ts(x)` |
| Integration | Vitest + MSW v2 (déjà installé) | À côté + setup global existant |
| E2E | Playwright | `apps/web/e2e/pack-section*.spec.ts` |
| A11y | `@axe-core/playwright` | `apps/web/e2e/pack-section-a11y.spec.ts` |
| Visual regression | Playwright `toHaveScreenshot` (backlog) | — |

## 3. Conventions

### 3.1 Nommage

- Fichier : `<source>.test.ts(x)` co-localisé
- Describe : nom du composant / fonction
- It : « doit … » en français

### 3.2 Fixtures partagées

`apps/web/src/test/fixtures/pack.ts` (nouveau) :

```ts
export const mockPackHero: ProductFeedHero = { /* … */ };
export const mockPackFeed: ProductFeed = { /* … */ };
export const mockPackOverride = (over: Partial<KitPackOverride> = {}): KitPackOverride => ({ /* … */ });
```

### 3.3 Mocks récurrents

```ts
const emitMock = vi.fn();
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock }),
}));
```

`emitMock.mockReset()` dans `beforeEach`.

## 4. Tests unit (Vitest)

### 4.1 Helpers Phase 0 — ~10 cas

`lib/kit/pack/savings.test.ts` (~5 cas) :
- ✅ `computePackSavings(39000, 19900)` = `{ amountMajor: 191, percent: 49, hasSavings: true }`
- ✅ `computePackSavings(19900, null)` = `{ hasSavings: false }`
- ✅ `computePackSavings(19900, 19900)` = `{ hasSavings: false }` (égalité)
- ✅ `computePackSavings(19900, 25000)` = `{ hasSavings: false }` (promo > prix = invalide)
- ✅ Précision : arrondi correct (391 → 100 % vrai)

`lib/kit/pack/per-usage.test.ts` (~5 cas) :
- ✅ `buildPerUsageHint({ pricePromoCents: 19900, currency: 'MAD' })` → format français correct
- ✅ Avec `manicuresPerPack` custom
- ✅ Avec `salonManicuresPerYear` custom
- ✅ Virgule décimale française (« 1,5 » pas « 1.5 »)
- ✅ Inclut « MAD/an » et « par manucure »

### 4.2 Schemas Phase 0/4 — ~12 cas

`lib/products/feed/pack.composition.test.ts` (étend tests `kit-feed`) :
- ✅ Rétro-compat : `ProductFeedHero` sans `valueBreakdown`/`perUsageHint`/`ctaAccent`
- ✅ Avec extensions valides
- ❌ `valueBreakdown.items` vide refusé
- ❌ `valueBreakdown.items` > 8 refusé
- ❌ `perUsageHint` > 160 chars refusé
- ❌ `ctaAccent` hors enum refusé

`lib/kit/pack/schemas.test.ts` (~6 cas) :
- ✅ `kitPackOverrideUpsertSchema` patch vide accepté
- ✅ Reset via `null` accepté
- ❌ `title` > 120 chars refusé
- ❌ `lead` > 280 chars refusé
- ❌ `ctaLabel` > 40 chars refusé
- ✅ `valueBreakdown.items[i].priceCents` négatif refusé

### 4.3 Resolver + Store Phase 4 — ~15 cas

`lib/kit/pack/resolver.test.ts` (~10 cas) :
- ✅ Mock pur quand aucun override
- ✅ Override publié → merge sur mock
- ✅ Override draft → mock côté public
- ✅ Override draft → draft côté admin (`resolveKitPackDraft`)
- ✅ `null` dans override → retour au mock pour ce champ
- ✅ Merge profond sur `hero.*`
- ✅ Merge sur `socialProof.countLabelGeo`
- ✅ Préservation `steps` / `claims` non éditables

`lib/kit/pack/store.test.ts` (~5 cas) :
- ✅ get/upsert/publish/unpublish/reset cycle
- ✅ Singleton id stable `'kit-pack'`

### 4.4 Composants publics Phase 0-3 — ~25 cas

`components/commerce/PriceBlock.test.tsx` (~12 cas) :
- ✅ Rend `valueBreakdown` si présent (Phase 0)
- ✅ Omet `valueBreakdown` si absent (rétrocompat)
- ✅ Rend prix principal en `text-5xl`
- ✅ Rend prix barré en `text-lg` (60 %)
- ✅ Aria-label sur prix barré
- ✅ Rend `pack-savings-line` terracotta si `hasSavings`
- ✅ Couleur savings = `#C28A6E` (verif via `style.color`)
- ✅ Rend `pack-per-usage` si `perUsageHint`
- ✅ CTA prend la couleur `ctaAccent`
- ✅ CTA = `bg-encre` si `ctaAccent` absent (rétrocompat)
- ✅ CTA porte la classe `motion-safe:animate-soft-pulse`
- ✅ Microcopy trust row toujours rendue

`components/commerce/ValueBreakdownList.test.tsx` (~5 cas) :
- ✅ Rend tous les items avec « + » entre
- ✅ Calcule le total correctement
- ✅ Affiche `totalLabel` puis « ≈ {total} {currency} »
- ✅ Aria-hidden sur les `+` séparateurs
- ✅ Format tabular-nums sur les chiffres

`components/sections/PackVisual.test.tsx` (~3 cas) :
- ✅ Rend `<img>` avec src `/products/kit-principale.svg`
- ✅ `alt` descriptif
- ✅ Aspect-ratio 16:10

`components/sections/PackSectionTracker.test.tsx` (~5 cas) :
- ✅ IntersectionObserver attaché × 3 (section + savings + social proof)
- ✅ Émit `pack_section_view` au franchissement section 0.5
- ✅ Émit `pack_economy_view` au franchissement savings 0.8
- ✅ Émit `pack_social_proof_view` au franchissement bandeau 0.5
- ✅ Cleanup disconnect au unmount

### 4.5 ProductFeedSection refactor — ~6 cas

`components/sections/ProductFeedSection.test.tsx` (refactor existant) :
- ✅ Rend `PackVisual` au-dessus de `PriceBlock`
- ✅ Rend les 4 step cards
- ✅ Rend les 3 claims
- ✅ Rend social proof avec `countLabelGeo` si présent
- ✅ Fallback `${reviewsCount} avis` si `countLabelGeo` absent
- ✅ Section id `product-feed`, anchorId override OK

### 4.6 API routes admin Phase 4 — ~17 cas

`app/api/admin/kit/pack/route.test.ts` GET/PATCH (~10 cas) :
- ✅ 401 sans session
- ✅ 200 retourne `{ override, resolved }`
- ✅ PATCH 200 avec patch valide
- ✅ PATCH 422 avec patch invalide
- ✅ PATCH émet audit `kit_pack.update`
- ✅ `revalidateTag('kit-pack')` appelé
- ✅ Patch `null` reset un champ
- ✅ Patch préserve les autres champs

`publish/route.test.ts` (~4 cas) :
- ✅ 401 sans session
- ✅ 404 si pas d'override
- ✅ 200 publie + audit
- ✅ idempotent

`reset/route.test.ts` (~3 cas) :
- ✅ 401 sans session
- ✅ 200 supprime + audit
- ✅ Idempotent (200 si déjà absent)

### 4.7 Admin components Phase 4 — ~25 cas

`components/admin/kit-pack/KitPackEditor.test.tsx` (~15 cas) :
- Pattern strict identique à `KitVideoEditor.test.tsx` :
  - Statut affiché correctement (Mock / Brouillon / Publié)
  - Champs pré-remplis depuis override
  - Validation live (erreur sous champ)
  - Bouton Save désactivé si !dirty
  - Bouton Save désactivé si !valid
  - Click Save appelle PATCH + affiche success
  - Click Publish appelle POST /publish + success
  - Reset modal bloque tant que `RESET-PACK` non saisi correctement
  - Reset confirmé appelle POST /reset
  - Radios `ctaAccent` changent la valeur du state

`ValueBreakdownEditor.test.tsx` (~8 cas) :
- ✅ Rend tous les items en lignes éditables
- ✅ + Ajouter item ajoute row vide
- ✅ ✕ Supprime item retire row
- ✅ Total auto-calculé visible
- ✅ Validation Zod sur priceCents négatif
- ✅ Max 8 items enforced (button Add disabled)
- ✅ `totalLabel` éditable
- ✅ Synchronise vers state parent à chaque change

## 5. Tests integration MSW Phase 4 — ~6 cas

`components/admin/kit-pack/KitPackEditor.integration.test.tsx` :

Utilise MSW pour mock les routes API au lieu de mocker fetch directement.
Simule un cycle complet **Save → Publish → Reset** avec timing réaliste.

Setup MSW :
```ts
// apps/web/src/test/msw/handlers/kit-pack.ts
export const kitPackHandlers = [
  http.get('/api/admin/kit/pack', /* … */),
  http.patch('/api/admin/kit/pack', /* … */),
  http.post('/api/admin/kit/pack/publish', /* … */),
  http.post('/api/admin/kit/pack/reset', /* … */),
];
```

Tests :
- ✅ Cycle complet Save → réponse 200 → success affiché
- ✅ Cycle Publish → success
- ✅ Cycle Reset → success + form vidé
- ✅ Save retourne 422 → erreur affichée
- ✅ Save retourne 500 → erreur réseau gérée gracieusement
- ✅ Refresh aperçu live à chaque keystroke (debounce 200 ms)

## 6. Tests E2E Playwright Phase 5 — ~15 cas

`apps/web/e2e/pack-section.spec.ts` :

```ts
test.describe('/kit pack — rendu @pack-render', () => {
  test('section visible avec heading « Le rituel s'installe… »');
  test('PackVisual présent avec src /products/kit-principale.svg');
  test('ValueBreakdownList rend Paste + Powder + Polissoir + total');
  test('Prix 199 en text-5xl, barré 390 en text-lg');
  test('« Économie 191 MAD » terracotta visible');
  test('Reframing « ≈ 1,5 MAD/manucure » visible');
  test('CTA « Commander le rituel » sauge-dark avec micro-pulse');
  test('Social proof affiche libellé géographique');
});

test.describe('/kit pack — interactions @pack-interaction', () => {
  test('Click CTA scroll vers #commander-femiglow');
  test('Click CTA émet pack_cta_click');
  test('Scroll vers section émet pack_section_view');
  test('Scroll vers savings émet pack_economy_view');
});

test.describe('/kit pack — responsive @pack-responsive', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('mobile : prix lisible sans wrap, CTA full-width');

  test.use({ viewport: { width: 1280, height: 800 } });
  test('desktop : 4 step cards en grid horizontale, packshot max-w-xl');
});

test.describe('/kit pack — a11y @pack-a11y', () => {
  test('0 violation axe sérieuse/critique sur #product-feed');
});
```

`apps/web/e2e/admin-pack.spec.ts` :

```ts
test.describe('/admin/kit/pack — éditeur @pack-admin', () => {
  test('page protégée par auth (skip gracieux sans session)');
  test('éditeur charge avec statut Mock par défaut');
  test('save modifie + success affiché');
  test('reset modal bloque sans saisie RESET-PACK');
  test('a11y axe sur l\'éditeur');
});
```

## 7. Visual regression (backlog)

Snapshots Playwright sur :
- `/kit#product-feed` viewport 375×812 — full section
- `/kit#product-feed` viewport 1280×800 — full section
- `/admin/kit/pack` — éditeur

## 8. Couverture

Configuration vitest :

```ts
coverage: {
  provider: 'v8',
  include: ['src/lib/kit/pack/**', 'src/components/commerce/PriceBlock*', 'src/components/commerce/ValueBreakdownList*', 'src/components/sections/ProductFeedSection*', 'src/components/sections/PackVisual*', 'src/components/sections/PackSectionTracker*'],
  thresholds: {
    branches: 90,
    functions: 90,
    lines: 90,
    statements: 90,
  },
},
```

## 9. Anti-flake

| Risque | Mitigation |
|---|---|
| IntersectionObserver async timing | Mock IO via `globalThis.IntersectionObserver = vi.fn(...)` |
| Reveal animation timing variable | `vi.useFakeTimers()` ou test sur DOM final via `waitFor` |
| Prefers-reduced-motion variable | Mock `useReducedMotion` via vi.mock |
| Playwright micro-pulse animation | `animation: none` injecté en CSS via `page.addStyleTag` avant assertion visuelle |
| MSW handler order | Enregistrer handlers `beforeAll`, reset entre tests |

## 10. CI

Tous les tests doivent passer sur :
- Node 20 (cible CI principale)
- Linux (CI Vercel) + macOS (dev local)

`pnpm --filter web exec vitest run` exit 0 obligatoire pour merge.
`pnpm playwright test --grep '@pack-'` 100 % vert avant déploiement.

## 11. Régression à monitorer

Tests existants à ne PAS casser :
- `kit-feed.test.ts` → refactor obligatoire (champs additifs uniquement)
- `ProductFeedSection.test.tsx` → refactor signature
- `assertValidProductFeed` Zod schema validation
- Feed XML Merchant : `merchant.test.ts` doit toujours générer un XML valide
- Toutes les suites précédentes (vidéo, composition, INCI)
