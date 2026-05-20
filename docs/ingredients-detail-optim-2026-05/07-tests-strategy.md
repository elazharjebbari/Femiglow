# 07 — Stratégie de tests

Vitest (unit + integration MSW) + Playwright (E2E + a11y). Couverture cible
**≥ 90 % branches sur `lib/kit/composition/**`** et **≥ 85 % sur `components/commerce/Ingredient*`**.

## 1. Pyramide

```
       +-------------------+
       |  E2E Playwright   |  ~ 6 specs
       +-------------------+
      +---------------------+
      |  Integration MSW    |  ~ 8 specs
      +---------------------+
     +-----------------------+
     |   Unit (Vitest)       |  ~ 60 specs
     +-----------------------+
```

Cible : 80 % unit, 12 % MSW, 8 % E2E.

## 2. Outillage

| Couche | Outil | Localisation |
|---|---|---|
| Unit | Vitest + Testing Library | Co-localisée `*.test.ts(x)` |
| Integration | Vitest + MSW v2 + DOMPurify (déjà installé) | À côté + setup global existant |
| E2E | Playwright | `apps/web/e2e/composition-detail*.spec.ts` |
| A11y | `@axe-core/playwright` | `apps/web/e2e/composition-detail-a11y.spec.ts` |
| Visual regression | Playwright `toHaveScreenshot` (backlog P4) | — |

## 3. Conventions

### 3.1 Nommage

- Fichier : `<source>.test.ts(x)` co-localisé
- Describe : nom du composant / fonction (ex. `'IngredientCard — rendu'`)
- It : « doit … » ou affirmation en français (ex. `'affiche le pourcentage en accent'`)

### 3.2 Fixtures partagées

`apps/web/src/test/fixtures/composition.ts` (nouveau) :

```ts
export const mockPasteSubProduct: SubProduct = { /* … */ };
export const mockPowderSubProduct: SubProduct = { /* … */ };
export const mockComposition: SubProduct[] = [mockPasteSubProduct, /* … */];
```

Réutilisé par tous les tests pour éviter la duplication.

### 3.3 Mocks `useTracking`

```ts
const emitMock = vi.fn();
vi.mock('@/lib/tracking/use-tracking', () => ({
  useTracking: () => ({ emit: emitMock }),
}));
```

`emitMock.mockReset()` dans `beforeEach`.

### 3.4 Mocks `next/image`

Inchangé (pattern existant) :

```ts
vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));
```

## 4. Tests unit (Vitest)

### 4.1 Schemas (Phase 1) — ~15 cas

`lib/schemas/product.composition.test.ts` (étend tests existants) :

- ✅ rétro-compat sans `inciDefinition` / `narrative` / `usageHint`
- ✅ accepte avec extensions valides
- ❌ refuse `narrative` sans ponctuation finale
- ❌ refuse `narrative` > 320 chars
- ❌ refuse `inciDefinition` > 200 chars
- ❌ refuse `usageHint` > 60 chars
- ✅ `kitCompositionOverrideUpsertSchema` accepte patch vide
- ❌ refuse `subProductId` hors enum
- ❌ refuse `ingredients[]` vide
- ❌ refuse `certifications.label` > 60 chars
- ✅ Accept `null` pour reset (narrative, certifications, ingredient field)
- ✅ Mock `mockKitPageContent.composition` parse avec extensions ajoutées

### 4.2 Helpers (Phase 1)

`lib/kit/composition/sort.test.ts` (~5 cas) :
- ✅ trie par `%` décroissant
- ✅ ingrédients sans `concentrationPct` placés en queue
- ✅ retourne nouvelle ref (immutabilité)
- ✅ stable sur ingrédients égaux
- ✅ comportement OK sur tableau vide

### 4.3 Resolver + Store (Phase 1)

`lib/kit/composition/resolver.test.ts` (~20 cas) :
- ✅ mock pur quand aucun override
- ✅ override publié → merge sur mock
- ✅ override draft → mock côté public (`resolveKitComposition`)
- ✅ override draft → draft côté admin (`resolveKitCompositionDraft`)
- ✅ `null` dans override → retour au mock pour ce champ
- ✅ merge ingredients par INCI key
- ✅ store : get/upsert/publish/unpublish/reset

### 4.4 Composants publics (Phase 2-4)

`components/commerce/IngredientCard.test.tsx` (~10 cas) :
- ✅ rend nom + INCI + % + fonction + origine
- ✅ teinte le `%` en accent color
- ✅ pas de tooltip si `inciDefinition` absent
- ✅ bouton tooltip présent + aria-label si `inciDefinition` présent
- ✅ click tooltip → emit `composition_inci_tooltip_open`
- ✅ rétrocompat sans accentColor (fallback champagne)
- ✅ data-testid stable

`components/commerce/InciTooltip.test.tsx` (~8 cas) :
- ✅ rend bouton ⓘ avec aria-label
- ✅ rend popover avec role="tooltip"
- ✅ popover affiche définition
- ✅ click emit event
- ✅ texte INCI affiché dans popover
- ✅ focus visible ring
- ✅ pas d'erreur si popoverTarget non supporté (fallback graceful)

`components/commerce/NarrativeIntro.test.tsx` (~5 cas) :
- ✅ rend le texte en italique
- ✅ IntersectionObserver attaché au mount
- ✅ emit `composition_narrative_view` au franchissement seuil 0.5
- ✅ emit une seule fois (pas de re-emit)
- ✅ cleanup au unmount

`components/commerce/PostCtaLink.test.tsx` (~6 cas) :
- ✅ rend `<a>` avec href par défaut
- ✅ click emit `composition_post_cta_click`
- ✅ scrollIntoView smooth si ancre interne
- ✅ pas d'interception sur href absolue (laisse navigation)
- ✅ data-testid stable

`components/commerce/ResponsiveIngredientList.test.tsx` (~6 cas) :
- ✅ rend cards mobile (queryByTestId match)
- ✅ rend table desktop
- ✅ trie par % décroissant
- ✅ propage `subProductId` aux enfants
- ✅ propage `accentColor`

`components/commerce/SubProductBlock.test.tsx` (~10 cas) :
- ✅ rend titre + volume + usageHint si présent
- ✅ summary cliquable ouvre/ferme
- ✅ `defaultOpen` honoré
- ✅ rend NumberBadge avec accent color
- ✅ rend `narrative` si présent
- ✅ rend `ResponsiveIngredientList`
- ✅ rend `CertificationsList`
- ✅ rend `PostCtaLink`
- ✅ emit `composition_accordion_open` au déploiement
- ✅ anchor id stable

`components/commerce/IngredientsTable.test.tsx` (existant — refactor + ~5 cas) :
- Tests existants à adapter au nouveau signature (`ingredients` au lieu de `subProduct`)
- + tests lignes alternées
- + tests tri % décroissant
- + tests tooltip INCI intégré dans la cell

`components/sections/IngredientsDetails.test.tsx` (~6 cas) :
- ✅ rend kicker + H2 + subtitle
- ✅ rend les 3 sous-produits
- ✅ premier sous-produit ouvert, les 2 autres fermés (sur mobile)
- ✅ accepte `mediaSlot` (rendu si fourni)
- ✅ pas de régression sur l'ancien comportement (test snapshot)
- ✅ anchor IDs stables

### 4.5 API routes admin (Phase 5)

`app/api/admin/kit/composition/[id]/route.test.ts` GET/PATCH (~12 cas) :
- ✅ 401 sans session
- ✅ 404 si subProductId hors enum
- ✅ 200 retourne `{override, resolved}`
- ✅ PATCH 200 avec patch valide
- ✅ PATCH 422 avec patch invalide (Zod)
- ✅ PATCH émet audit `kit_composition.update`
- ✅ PATCH `revalidateTag('kit-composition')` appelé
- ✅ `null` pour reset un champ
- ✅ Patch préserve les autres champs

`app/api/admin/kit/composition/[id]/publish/route.test.ts` (~5 cas) :
- ✅ 401 sans session
- ✅ 404 si pas d'override
- ✅ 200 publie + audit
- ✅ idempotent

`app/api/admin/kit/composition/[id]/reset/route.test.ts` (~3 cas) :
- ✅ 401 sans session
- ✅ 200 supprime + audit
- ✅ idempotent (200 si déjà absent)

### 4.6 Admin components (Phase 5)

`components/admin/kit-composition/KitCompositionEditor.test.tsx` (~20 cas) :
- Pattern strict identique à `KitVideoEditor.test.tsx` :
  - Statut affiché correctement (Mock / Brouillon / Publié)
  - Champs pré-remplis depuis override
  - Validation live (erreur sous champ)
  - Bouton Save désactivé si !dirty
  - Bouton Save désactivé si !valid
  - Click Save appelle PATCH + affiche success
  - Click Publish appelle POST /publish + success
  - Reset modal bloque tant que mot tapé incorrect
  - Reset confirmé appelle POST /reset
  - Ajout d'ingrédient ajoute une row dans la liste
  - Suppression d'ingrédient retire la row

`IngredientsArrayEditor.test.tsx` (~10 cas) :
- ✅ rend tous les ingrédients en accordéons
- ✅ + Ajouter ajoute item vide
- ✅ ✕ Supprimer retire item
- ✅ ordre des inputs préservé
- ✅ tri par % décroissant visible côté preview
- ✅ INCI affiché avec warning si modifié (clé immuable)

`CertificationsEditor.test.tsx` (~5 cas) :
- ✅ add/remove certifications
- ✅ validation label/body required
- ✅ max 8 enforced (button Add disabled)

`CompositionPreviewCard.test.tsx` (~4 cas) :
- ✅ rend `SubProductBlock` avec les valeurs du form state
- ✅ se met à jour à chaque keystroke (debounce 200 ms si nécessaire)

## 5. Tests integration MSW (Phase 5)

`components/admin/kit-composition/KitCompositionEditor.integration.test.tsx` (~6 cas) :

Utilise MSW pour mock les routes API au lieu de mocker fetch directement.
Simule un cycle complet **Save → Publish → Reset** avec timing réaliste.

Setup MSW :
```ts
// apps/web/src/test/msw/handlers/kit-composition.ts
export const kitCompositionHandlers = [
  http.get('/api/admin/kit/composition/:id', /* … */),
  http.patch('/api/admin/kit/composition/:id', /* … */),
  http.post('/api/admin/kit/composition/:id/publish', /* … */),
  http.post('/api/admin/kit/composition/:id/reset', /* … */),
];
```

Tests :
- ✅ Cycle complet Save → réponse 200 → success affiché
- ✅ Cycle Publish → success
- ✅ Cycle Reset → success + form vidé
- ✅ Save retourne 422 → erreur affichée
- ✅ Save retourne 500 → erreur réseau gérée gracieusement
- ✅ Reset via le bon path mais subProductId hors enum → 404 mocké → erreur

## 6. Tests E2E Playwright (Phase 6)

`apps/web/e2e/composition-detail.spec.ts` :

```ts
test.describe('/kit composition — rendu @composition-render', () => {
  test('section visible avec heading « La composition lue ligne par ligne. »', /* … */);
  test('3 sous-produits rendus dans la section', /* … */);
  test('premier sous-produit ouvert par défaut sur mobile', /* … */);
  test('narrative italique présent dans le 1er sous-produit', /* … */);
});

test.describe('/kit composition — interactions @composition-interaction', () => {
  test('click summary ouvre/ferme accordéon', /* … */);
  test('click ⓘ ouvre tooltip avec définition INCI', /* … */);
  test('click « Voir le pack ↓ » scroll vers #commander-femiglow', /* … */);
  test('hiérarchie : nom + % en gros, INCI petit, fonction/origine gris', /* … */);
});

test.describe('/kit composition — a11y @composition-a11y', () => {
  test('0 violation axe sérieuse/critique sur section', /* … */);
  test('focus visible sur summary, tooltip, post-CTA', /* … */);
  test('Esc ferme le popover tooltip', /* … */);
  test('Tab navigue dans l\'ordre logique', /* … */);
});

test.describe('/kit composition — responsive @composition-responsive', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('mobile : cards verticales, pas de scroll horizontal', /* … */);

  test.use({ viewport: { width: 1280, height: 800 } });
  test('desktop : tableau 5 colonnes, accordéons tous ouverts', /* … */);
});
```

`apps/web/e2e/admin-composition-detail.spec.ts` (Phase 6) :

```ts
test.describe('/admin/kit/composition — éditeur @composition-admin', () => {
  test('liste affiche 3 sous-produits avec statut', /* … */);
  test('éditeur charge avec mock par défaut', /* … */);
  test('Save → POST PATCH → success affiché', /* … */);
  test('Publish désactivé si dirty', /* … */);
  test('Reset modal bloque sans saisie correcte', /* … */);
});
```

## 7. Visual regression (backlog P4)

Backlog pour la phase ultérieure. Snapshots Playwright sur :
- `/kit` viewport 375×812 — section déployée
- `/kit` viewport 1280×800 — section déployée
- `/admin/kit/composition/1-paste` — éditeur

## 8. Couverture

Configuration vitest existante :

```ts
// vitest.config.ts
coverage: {
  provider: 'v8',
  include: ['src/lib/kit/composition/**', 'src/components/commerce/Ingredient*'],
  thresholds: {
    branches: 90,
    functions: 90,
    lines: 90,
    statements: 90,
  },
},
```

À ajuster à la livraison Phase 1.

## 9. Anti-flake

| Risque | Mitigation |
|---|---|
| IntersectionObserver async timing | Test : forcer l'entry callback via `obs.observe(el)` puis `act()` |
| Popover API < Chrome 114 | Test : feature-detect avant l'assertion |
| `<details>` toggle async | Test : `fireEvent.click(summary)` puis attendre `details.open === true` |
| MSW handler order | Test : enregistrer handlers `beforeAll`, reset entre tests |
| Playwright axe sur SVG inline | Test : exclure des règles axe les attributs ARIA Vendor (cf. video phase 8) |

## 10. CI

Tous les tests doivent passer sur :
- Node 20 (cible CI principale)
- Node 18 (compat backlog)
- Linux (CI Vercel)
- macOS Apple Silicon (dev local)

`pnpm --filter web exec vitest run` = exit 0 obligatoire pour merge.
`pnpm playwright test --grep '@composition-'` = 100 % vert avant déploiement.

## 11. Régression à monitorer

Tests existants à **ne pas casser** :
- `IngredientsTable.test.tsx` → refactor obligatoire (changement signature) avec migration douce
- Toute la suite vidéo (cf. `video-gestes-optim-2026-05`)
- Toute la suite composition (cf. `composition-reveal-optim-2026-05`)
- Snapshots `/kit` E2E existants
